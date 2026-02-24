const Order = require('../models/Order');
const Book = require('../models/Book');
const Discount = require('../models/Discount');
const Referral = require('../models/Referral');
const crypto = require('crypto');
const Config = require('../models/Config');
const axios = require('axios');

// @route   POST /api/orders/checkout
// @desc    Create new order & return payment gateway payload
exports.createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress, discountCode, referralCode } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    let subtotal = 0;
    let hasPhysicalItem = false;
    const itemsForDB = [];

    // 1. Securely calculate prices from Database (Never trust frontend prices)
    for (const item of orderItems) {
      const book = await Book.findById(item.bookId);
      if (!book) return res.status(404).json({ message: `Book not found: ${item.bookId}` });
      
      if (book.type === 'Physical') {
        hasPhysicalItem = true;
        if (book.stock < item.qty) {
          return res.status(400).json({ message: `Insufficient stock for ${book.title}` });
        }
      }

      const itemTotal = book.price * item.qty;
      subtotal += itemTotal;

      itemsForDB.push({
        book: book._id,
        name: book.title,
        qty: item.qty,
        price: book.price
      });
    }

    // 2. Shipping Logic (e.g., ₹50 flat rate for physical, free for digital)
    const shipping = hasPhysicalItem ? 50 : 0;
    let total = subtotal + shipping;
    
    // 3. Discount Logic
    let discountAmount = 0;
    let appliedDiscountCode = null;

    if (discountCode) {
      const discount = await Discount.findOne({ code: discountCode.toUpperCase(), status: 'Active' });
      
      if (discount) {
        // Check expiry
        if (discount.validTill && new Date(discount.validTill) < new Date()) {
          return res.status(400).json({ message: 'Discount code has expired' });
        }
        // Check usage limits
        if (discount.maxUsage && discount.currentUsage >= discount.maxUsage) {
          return res.status(400).json({ message: 'Discount code usage limit reached' });
        }

        if (discount.type === 'Percentage') {
          const calcDiscount = (subtotal * discount.value) / 100;
          discountAmount = Math.min(calcDiscount, discount.maxDiscount);
        } else {
          discountAmount = discount.value;
        }
        
        total -= discountAmount;
        appliedDiscountCode = discount.code;
        
        // Increment usage
        discount.currentUsage += 1;
        await discount.save();
      }
    }

    // 4. Referral Logic (If used instead of or alongside discount)
    let appliedReferral = null;
    if (referralCode && !appliedDiscountCode) { // Assuming they can't use both, or adjust as needed
      const referral = await Referral.findOne({ code: referralCode.toUpperCase(), status: 'Active' }).populate('user', 'name');
      if (referral) {
        appliedReferral = {
          code: referral.code,
          referrerName: referral.user.name
        };
        // Note: We don't credit the referrer until payment is SUCCESSFUL (handled in webhook)
        
        // If referral also acts as a discount
        if (referral.isDiscountLinked) {
            const refDiscount = 50; // Example flat ₹50 off for using referral
            discountAmount = refDiscount;
            total -= discountAmount;
        }
      }
    }

    // 5. Generate Unique Order ID
    const uniqueOrderId = `BK-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;

    // 6. Create the Order in Database
    const order = await Order.create({
      orderId: uniqueOrderId,
      user: req.user._id, // From authMiddleware
      items: itemsForDB,
      priceBreakup: {
        subtotal,
        shipping,
        discountCode: appliedDiscountCode,
        discountAmount: -discountAmount,
        referralApplied: appliedReferral ? appliedReferral.code : null,
        total: Math.max(0, total) // Prevent negative totals
      },
      shipping: {
        address: hasPhysicalItem ? shippingAddress : 'Digital Delivery',
        partner: 'Pending Assign'
      },
      status: 'Pending Payment',
      transitHistory: [{ stage: 'Order Placed (Awaiting Payment)', time: Date.now(), completed: true }]
    });

    // 7. Generate Payment Gateway Payload (Example for PhonePe)
    // In a real app, you would construct the base64 payload and X-VERIFY checksum here
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const payConfig = config ? config.payment : null; // <-- This variable was missing!
    // Fallback to env if DB config is empty (great for testing)
    const merchantId = payConfig?.merchantId || process.env.PHONEPE_MERCHANT_ID;

    if (!merchantId) {
      return res.status(500).json({ message: 'Payment gateway is not configured by Admin yet.' });
    }

    // Fallbacks for frontend/api URLs in case env vars aren't loaded locally yet
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5001';
    
    const paymentPayload = {
      merchantId: merchantId,
      merchantTransactionId: order.orderId,
      merchantUserId: req.user._id.toString(),
      amount: order.priceBreakup.total * 100, // PhonePe accepts amount in paise
      redirectUrl: `${frontendUrl}/payment-status/${order.orderId}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${apiUrl}/api/webhooks/phonepe`,
      mobileNumber: req.user.mobile,
      paymentInstrument: { type: "PAY_PAGE" }
    };

    res.status(201).json({
      success: true,
      orderId: order.orderId,
      totalAmount: order.priceBreakup.total,
      paymentPayload // Send this to React to open the payment gateway
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/orders/myorders
// @desc    Get logged in user's orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.book', 'title type')
      .sort({ createdAt: -1 });
      
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/orders/verify-payment/:orderId
// @desc    Manually check PhonePe status (Fallback if webhook misses)
exports.verifyPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // If it's already updated by webhook, just return it
    if (order.status !== 'Pending Payment') {
      return res.status(200).json({ status: order.status, paymentStatus: order.payment.status });
    }

    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const payConfig = config ? config.payment : null;

    const merchantId = payConfig?.merchantId || process.env.PHONEPE_MERCHANT_ID;
    const saltKey = payConfig?.saltKey || process.env.PHONEPE_SALT_KEY;
    const saltIndex = payConfig?.saltIndex || 1;

    if (!merchantId || !saltKey) return res.status(500).json({ message: 'Payment config missing' });

    const baseUrl = payConfig?.isLiveMode ? (process.env.PHONEPE_LIVE_URL || 'https://api.phonepe.com/apis/hermes') : (process.env.PHONEPE_UAT_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox');
    const endpoint = `/pg/v1/status/${merchantId}/${order.orderId}`;
    
    // SHA256("/pg/v1/status/{merchantId}/{merchantTransactionId}" + saltKey) + "###" + saltIndex
    const checksum = crypto.createHash('sha256').update(endpoint + saltKey).digest('hex') + "###" + saltIndex;

    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, 'X-MERCHANT-ID': merchantId }
      });

      const { code, data } = response.data;

      if (code === 'PAYMENT_SUCCESS') {
        order.status = 'In Progress';
        order.payment.status = 'Success';
        order.payment.txnId = data.transactionId;
        order.transitHistory.push({ stage: 'Payment Verified (Manual Sync)', time: Date.now(), completed: true });
        
        // Deduct inventory
        for (const item of order.items) {
          const book = await Book.findById(item.book);
          if (book && book.type === 'Physical' && book.stock > 0) {
            book.stock -= item.qty;
            book.history.unshift({ type: 'Deduction', reason: `Order #${order.orderId}`, change: -item.qty, balance: book.stock });
            await book.save();
          }
        }
      } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
        order.status = 'Failed';
        order.payment.status = 'Failed';
      }
      
      await order.save();
      return res.status(200).json({ status: order.status, paymentStatus: order.payment.status, code });

    } catch (apiError) {
      // If PhonePe returns 400/401/404, the payment was never initiated properly or keys are fake
      order.status = 'Failed';
      order.payment.status = 'Failed';
      await order.save();
      return res.status(200).json({ status: 'Failed', message: 'Payment dropped or invalid merchant keys.' });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};