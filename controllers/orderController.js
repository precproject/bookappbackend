const Order = require('../models/Order');
const Book = require('../models/Book');
const Discount = require('../models/Discount');
const Referral = require('../models/Referral');
const Config = require('../models/Config');

const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const PhonePeService = require('../services/phonepeService');
const delhiveryService = require('../services/delhiveryService'); // <-- Import Delhivery
const { processSuccessfulPayment } = require('../services/orderService');


// --- CREATE ORDER (The Cashier Calculates the Bill) ---
exports.createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress, discountCode, referralCode } = req.body;
    if (!orderItems || orderItems.length === 0) return res.status(400).json({ message: 'No order items provided' });

    const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const isGstEnabled = systemConfig?.taxConfig?.isGstEnabled ?? true;
    const gstPercentage = systemConfig?.taxConfig?.gstPercentage ?? 5;
    const configShippingCharge = systemConfig?.delivery?.shippingCharge ?? 50;

    let subtotal = 0;
    let hasPhysicalItem = false;
    const itemsForDB = [];

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

    // --- THE FIX: FORMAT THE SHIPPING OBJECT CORRECTLY FOR MONGOOSE ---
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
      // Digital Orders: Mongoose requires these fields, so we fill them with safe system fallbacks
      shippingData = {
        fullName: req.user.name,      // Pull real name from logged-in user
        phone: req.user.mobile,       // Pull real mobile from logged-in user
        street: 'Digital Delivery',
        city: 'Digital',
        state: 'Digital',
        pincode: '000000',
        partner: 'Email / Instant',
        trackingId: 'Digital'
      };
    }

    // CREATE THE ORDER
    const order = await Order.create({
      orderId: uniqueOrderId,
      user: req.user._id,
      items: itemsForDB,
      priceBreakup: { subtotal, shipping, discountCode: appliedDiscountCode, discountAmount, taxAmount, referralApplied: appliedReferral?.code, total: finalTotal },
      shipping: shippingData, // <-- USING THE NEW PROPER OBJECT
      status: 'Pending Payment',
      transitHistory: [{ stage: 'Order Placed (Awaiting Payment)', time: Date.now(), completed: true }]
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5001';

    if (finalTotal === 0) {
      await processSuccessfulPayment(order, 'DISC-100', '100% Discount',systemConfig);
      return res.status(201).json({ success: true, orderId: order.orderId, paymentPayload: { redirectUrl: `${frontendUrl}/payment-status/${order.orderId}` }});
    }

    const payEnv = await PhonePeService.getEnvConfig(Config);
    console.log(payEnv)
    if (!payEnv.merchantId) return res.status(500).json({ message: 'Payment gateway is not configured.' });

    const redirectUrl = await PhonePeService.initiatePayment({
      orderId: order.orderId,
      amount: finalTotal,
      userId: req.user._id,
      mobileNumber: req.user.mobile,
      redirectUrl: `${frontendUrl}/payment-status/${order.orderId}`,
      callbackUrl: `${apiUrl}/api/orders/webhook/phonepe`,
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
    res.status(500).json({ message: error.message });
  }
};

// --- VERIFY PAYMENT (Checking the Bank Machine) ---
exports.verifyPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status !== 'Pending Payment') {
      return res.status(200).json({ status: order.status, paymentStatus: order.payment.status });
    }

    const payEnv = await PhonePeService.getEnvConfig(Config);
    const { code, data } = await PhonePeService.checkStatus({ orderId: order.orderId, env: payEnv });

    if (code === 'PAYMENT_SUCCESS') {
      await processSuccessfulPayment(order, data.transactionId, data.paymentInstrument?.type || 'Online', payEnv);
    } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
      order.payment.status = 'Failed';
      await order.save();
    }
    
    return res.status(200).json({ status: order.status, paymentStatus: order.payment.status, code });

  } catch (error) {
    res.status(500).json({ message: 'Gateway error during verification', details: error.message });
  }
};

// --- RETRY PAYMENT ---
exports.retryPayment = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending Payment') return res.status(400).json({ message: 'Order is not pending payment' });

    const payEnv = await PhonePeService.getEnvConfig(Config);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5001';

    const redirectUrl = await PhonePeService.initiatePayment({
      orderId: order.orderId,
      amount: order.priceBreakup.total,
      userId: req.user._id,
      mobileNumber: req.user.mobile,
      redirectUrl: `${frontendUrl}/payment-status/${order.orderId}`,
      callbackUrl: `${apiUrl}/api/orders/webhook/phonepe`,
      env: payEnv
    });

    res.status(200).json({ success: true, paymentPayload: { redirectUrl } });

  } catch (error) {
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

    // 2. Process PhonePe Refund
    const payEnv = await PhonePeService.getEnvConfig(Config);
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5001';

    order.status = 'Refund Pending';
    await order.save();

    const response = await PhonePeService.initiateRefund({
      originalTxnId: order.payment.txnId,
      amount: order.priceBreakup.total,
      userId: order.user,
      callbackUrl: `${apiUrl}/api/orders/webhook/phonepe`,
      env: payEnv
    });

    if (response.code === 'PAYMENT_SUCCESS' || response.code === 'PAYMENT_PENDING') {
      order.status = 'Refunded';
      order.payment.status = 'Refunded';
      await order.save();
      res.status(200).json({ message: 'Refund initiated successfully', data: response });
    } else {
      // If the bank refuses the refund, we flag it as an error so the admin knows money wasn't returned!
      order.status = 'Refund Failed - Needs Attention';
      await order.save();
      res.status(400).json({ message: 'Refund failed at gateway. Order flagged for review.' });
    }

  } catch (error) {
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