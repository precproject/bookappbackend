const Order = require('../models/Order');
const Book = require('../models/Book');
const Discount = require('../models/Discount');
const Referral = require('../models/Referral');
const Config = require('../models/Config');

const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const PhonePeService = require('../services/phonepeService');
const delhiveryService = require('../services/delhiveryService'); 
const { processSuccessfulPayment } = require('../services/orderService');

// --- CREATE ORDER (The Cashier Calculates the Bill) ---
exports.createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress, discountCode, referralCode } = req.body;
    if (!orderItems || orderItems.length === 0) return res.status(400).json({ message: 'No order items provided' });

    // =========================================================================
    // 1. IDEMPOTENCY / ANTI-SPAM CHECK (Prevents Double-Click Order Duplication)
    // =========================================================================
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existingPendingOrder = await Order.findOne({
      user: req.user._id,
      status: 'Pending Payment',
      createdAt: { $gte: fifteenMinutesAgo }
    }).sort({ createdAt: -1 });

    if (existingPendingOrder) {
      // Create comparison strings for items (e.g., "bookId_qty|bookId2_qty2")
      const existingItemsStr = existingPendingOrder.items.map(i => `${i.book.toString()}_${i.qty}`).sort().join('|');
      const incomingItemsStr = orderItems.map(i => `${i.bookId}_${i.qty}`).sort().join('|');
      
      // Compare Addresses
      const isSameAddress = shippingAddress 
        ? existingPendingOrder.shipping?.pincode === shippingAddress.pincode && existingPendingOrder.shipping?.street === shippingAddress.street
        : true; // Digital orders always match

      // If items, address, and discount match, REUSE the existing order!
      if (existingItemsStr === incomingItemsStr && isSameAddress && existingPendingOrder.priceBreakup?.discountCode === discountCode) {
        console.log(`[Order System] Resuming existing pending order #${existingPendingOrder.orderId} to prevent duplicates.`);
        
        const payEnv = await PhonePeService.getEnvConfig(Config);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Regenerate the payment link for the existing order
        const { redirectUrl } = await PhonePeService.initiatePayment({
          orderId: existingPendingOrder.orderId,
          amount: existingPendingOrder.priceBreakup.total,
          redirectUrl: `${frontendUrl}/payment-status/${existingPendingOrder.orderId}`,
          env: payEnv
        });

        // Return 200 OK (Not 201 Created) since we reused the order
        return res.status(200).json({ 
          success: true, 
          orderId: existingPendingOrder.orderId, 
          paymentPayload: { redirectUrl },
          message: "Resumed existing pending order"
        });
      }
    }
    // =========================================================================

    const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const isGstEnabled = systemConfig?.taxConfig?.isGstEnabled ?? true;
    const gstPercentage = systemConfig?.taxConfig?.gstPercentage ?? 5;
    const configShippingCharge = systemConfig?.delivery?.shippingCharge ?? 50;

    let subtotal = 0;
    let hasPhysicalItem = false;
    const itemsForDB = [];

    // 2. Validate Inventory
    for (const item of orderItems) {
      const book = await Book.findById(item.bookId);
      if (!book) return res.status(404).json({ message: `Book not found` });
      
      if (book.type === 'Physical') {
        hasPhysicalItem = true;
        if (book.stock < item.qty) {
          const bookTitle = typeof book.title === 'object' ? (book.title.en || 'Book') : book.title;
          return res.status(400).json({ message: `Insufficient stock for ${bookTitle}` });
        }
      }
      
      const bookTitle = typeof book.title === 'object' ? (book.title.en || book.title.mr) : book.title;
      subtotal += book.price * item.qty;
      itemsForDB.push({ book: book._id, name: book.title, type: book.type, qty: item.qty, price: book.price });
    }

    let discountAmount = 0;
    let appliedDiscountCode = null;
    let appliedReferral = null;

    // 3. Process Discounts securely (Only triggered for NEW orders)
    if (discountCode) {
      const discount = await Discount.findOne({ code: discountCode.toUpperCase(), status: 'Active' });
      if (discount && (!discount.validTill || new Date(discount.validTill) > new Date()) && (!discount.maxUsage || discount.currentUsage < discount.maxUsage)) {
        discountAmount = discount.type === 'Percentage' 
          ? Math.min((subtotal * discount.value) / 100, discount.maxDiscount || Infinity)
          : discount.value;
        appliedDiscountCode = discount.code;
        discount.currentUsage += 1;
        await discount.save();
      }
    }

    if (referralCode && !appliedDiscountCode) {
      const referral = await Referral.findOne({ code: referralCode.toUpperCase(), status: 'Active' }).populate('user', 'name');
      if (referral) {
        appliedReferral = { code: referral.code, referrerName: referral.user?.name || 'User' };
        if (referral.isDiscountLinked) discountAmount = Math.min(referral.rewardRate, subtotal); 
      }
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxRateMultiplier = isGstEnabled ? (gstPercentage / 100) : 0;
    const taxAmount = Math.round(taxableAmount * taxRateMultiplier);
    const shipping = hasPhysicalItem ? configShippingCharge : 0; 
    const finalTotal = Math.round(taxableAmount + taxAmount + shipping);

    const uniqueOrderId = `BK-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;

    // 4. Handle Shipping Data Structure
    let shippingData = undefined;

    if (hasPhysicalItem) {
      if (!shippingAddress || !shippingAddress.pincode) {
        return res.status(400).json({ message: 'A complete shipping address is required for physical books.' });
      }
      shippingData = {
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
        partner: 'Pending Assign',
        trackingId: null
      };
    } else {
      shippingData = {
        fullName: req.user.name,
        phone: req.user.mobile,
        street: 'Digital Delivery',
        city: 'Digital',
        state: 'Digital',
        pincode: '000000',
        partner: 'Email / Instant',
        trackingId: 'Digital'
      };
    }

    // 5. Create Fresh Order
    const order = await Order.create({
      orderId: uniqueOrderId,
      user: req.user._id,
      items: itemsForDB,
      priceBreakup: { subtotal, shipping, discountCode: appliedDiscountCode, discountAmount, taxAmount, referralApplied: appliedReferral?.code, total: finalTotal },
      shipping: shippingData,
      status: 'Pending Payment',
      transitHistory: [{ stage: 'Order Placed (Awaiting Payment)', time: Date.now(), completed: true }]
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // 6. Free Order Bypass
    if (finalTotal === 0) {
      await processSuccessfulPayment(order, 'DISC-100', '100% Discount', systemConfig);
      return res.status(201).json({ success: true, orderId: order.orderId, paymentPayload: { redirectUrl: `${frontendUrl}/payment-status/${order.orderId}` }});
    }

    // 7. PhonePe Gateway Initialization
    const payEnv = await PhonePeService.getEnvConfig(Config);
    
    if (!payEnv.clientId) return res.status(500).json({ message: 'Payment gateway credentials are not configured.' });

    const { redirectUrl } = await PhonePeService.initiatePayment({
      orderId: order.orderId,
      amount: finalTotal,
      redirectUrl: `${frontendUrl}/payment-status/${order.orderId}`,
      env: payEnv
    });

    if (systemConfig?.emailAlerts?.orderPlaced !== false) {
      sendEmail({ 
        to: req.user.email, 
        subject: `ऑर्डर सुरू झाली - #${order.orderId} | Order Initiated`, 
        html: templates.orderPlacedEmail(order, req.user.name) 
      }).catch(console.error);
    }

    res.status(201).json({ success: true, orderId: order.orderId, paymentPayload: { redirectUrl } });

  } catch (error) {
    console.error("Order Creation Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- VERIFY PAYMENT (Checking the Bank Machine) ---
exports.verifyPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // If already processed by Webhook, return current status immediately
    if (order.status !== 'Pending Payment') {
      return res.status(200).json({ status: order.status, paymentStatus: order.payment.status });
    }

    // 1. Fetch the FULL config for processSuccessfulPayment (Emails, Referrals, etc.)
    const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    
    // 2. Fetch the Payment-specific environment variables
    const payEnv = await PhonePeService.getEnvConfig(Config);
    
    const statusResponse = await PhonePeService.checkStatus({ orderId: order.orderId, env: payEnv });

    console.log(statusResponse)
    if (statusResponse.state === 'COMPLETED') {
      // Safely grab the transaction ID
      const txnId = statusResponse?.paymentDetails?.transactionId || statusResponse.orderId;
      const paymentMethod = statusResponse?.paymentDetails?.paymentMode;

      // CRITICAL FIX: Pass systemConfig here, NOT payEnv!
      await processSuccessfulPayment(order, txnId, paymentMethod, systemConfig);
      
    } else if (statusResponse.state === 'FAILED') {
      order.payment.status = 'Failed';
      order.status = 'Failed';
      await order.save();
    }
    
    // Return the fresh state back to the React frontend
    return res.status(200).json({ 
      status: order.status, 
      paymentStatus: order.payment.status, 
      code: statusResponse.state 
    });

  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ message: 'Gateway error during verification', details: error.message });
  }
};

// --- RETRY PAYMENT ---
exports.retryPayment = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    // Security check: Only allow retries on pending orders
    if (order.status !== 'Pending Payment') {
      return res.status(400).json({ message: 'Order is not pending payment' });
    }

    const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const payEnv = await PhonePeService.getEnvConfig(Config);

    // =========================================================================
    // 1. PRE-RETRY STATUS CHECK & WAIT PERIOD LOGIC
    // =========================================================================
    try {
      const statusResponse = await PhonePeService.checkStatus({ orderId: order.orderId, env: payEnv });

      // Scenario A: The payment actually succeeded silently!
      if (statusResponse.state === 'COMPLETED') {
        const txnId = statusResponse.paymentDetailsList?.[0]?.transactionId || order.orderId;
        await processSuccessfulPayment(order, txnId, 'PhonePe', systemConfig);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Payment was already successful!', 
          alreadyPaid: true 
        });
      }

      // Scenario B: The payment is still processing at the bank
      if (statusResponse.state === 'PENDING') {
        const waitPeriodMs = 3 * 60 * 1000; // 3 minutes
        const timeSinceLastUpdate = Date.now() - new Date(order.updatedAt || order.createdAt).getTime();

        if (timeSinceLastUpdate < waitPeriodMs) {
          const remainingSeconds = Math.ceil((waitPeriodMs - timeSinceLastUpdate) / 1000);
          return res.status(429).json({ 
            success: false, 
            message: `Your previous payment attempt is still processing. Please wait ${remainingSeconds} seconds before retrying.` 
          });
        }
      }
      
      // Scenario C: Status is FAILED. Safe to proceed to Step 2.
    } catch (statusError) {
      // If checkStatus throws an error (e.g., 404 Not Found), it usually means 
      // the user dropped off before PhonePe even registered the first attempt.
      // It is completely safe to ignore this and proceed to create the new link.
      console.log(`[Retry Payment] No existing gateway session found for ${order.orderId}, proceeding with retry.`);
    }
    // =========================================================================

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // 2. Initiate a fresh V2 checkout session
    const { redirectUrl } = await PhonePeService.initiatePayment({
      orderId: order.orderId,
      amount: order.priceBreakup.total,
      redirectUrl: `${frontendUrl}/payment-status/${order.orderId}`,
      env: payEnv
    });

    // Reset the updatedAt timer so the 3-minute wait period starts over
    order.updatedAt = Date.now();
    await order.save();

    res.status(200).json({ success: true, paymentPayload: { redirectUrl } });

  } catch (error) {
    console.error("Retry Payment Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- REFUND ORDER (Returning the money & Cancelling Shipment) ---
exports.refundOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order || order.payment.status !== 'Success') return res.status(400).json({ message: 'Invalid order state for refund' });

    // 1. Cancel the Delhivery Shipment first if it exists
    if (order.shipping.trackingId && order.shipping.partner === 'Delhivery') {
      const cancelResult = await delhiveryService.cancelShipment(order.shipping.trackingId);
      if (cancelResult.success) {
        order.shipping.awbStatus = 'Cancelled';
        order.transitHistory.push({ stage: 'Shipment Cancelled with Courier', time: Date.now(), completed: true });
      }
    }

    // 2. Process PhonePe V2 Refund
    const payEnv = await PhonePeService.getEnvConfig(Config);

    order.status = 'Refund Pending';
    await order.save();

    // FIX 5: V2 strictly requires originalMerchantOrderId
    const response = await PhonePeService.initiateRefund({
      originalMerchantOrderId: order.orderId,
      amount: order.priceBreakup.total,
      env: payEnv
    });

    // FIX 6: V2 returns status inside 'state'
    if (response.state === 'PENDING' || response.state === 'COMPLETED') {
      order.status = 'Refunded';
      order.payment.status = 'Refunded';
      await order.save();
      res.status(200).json({ message: 'Refund initiated successfully', data: response });
    } else {
      order.status = 'Refund Failed - Needs Attention';
      await order.save();
      res.status(400).json({ message: 'Refund failed at gateway. Order flagged for review.' });
    }

  } catch (error) {
    console.error("Refund Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate('items.book', 'title type').sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};