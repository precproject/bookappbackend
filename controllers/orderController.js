const Order = require('../models/Order');
const Book = require('../models/Book');
const Discount = require('../models/Discount');
const Referral = require('../models/Referral');
const Config = require('../models/Config');

const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const PhonePeService = require('../utils/phonepeService');

// Helper to execute inventory and referral logic safely once a payment succeeds
const processSuccessfulPayment = async (order, transactionId, paymentMethod) => {
  if (order.status !== 'Pending Payment') return; // Prevent double execution

  order.status = 'In Progress';
  order.payment.status = 'Success';
  order.payment.txnId = transactionId;
  order.payment.method = paymentMethod;
  order.transitHistory.push({ stage: 'Payment Verified', time: Date.now(), completed: true });

  // 1. Deduct inventory securely
  for (const item of order.items) {
    const book = await Book.findById(item.book);
    if (book && book.type === 'Physical' && book.stock > 0) {
      book.stock -= item.qty;
      book.history.unshift({ type: 'Deduction', reason: `Order #${order.orderId}`, change: -item.qty, balance: book.stock });
      await book.save();
    }
  }

  // 2. Add to Referral Transactions if applicable
  if (order.priceBreakup.referralApplied) {
    const refDoc = await Referral.findOne({ code: order.priceBreakup.referralApplied });
    if (refDoc) {
      refDoc.uses += 1;
      refDoc.totalEarned += refDoc.rewardRate;
      refDoc.pendingPayout += refDoc.rewardRate;
      refDoc.transactions.push({
        order: order._id,
        earnedAmount: refDoc.rewardRate,
        payoutStatus: 'Pending',
        date: Date.now()
      });
      await refDoc.save();
    }
  }

  await order.save();
};

// @route   POST /api/orders/checkout
exports.createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress, discountCode, referralCode } = req.body;
    if (!orderItems || orderItems.length === 0) return res.status(400).json({ message: 'No order items provided' });

    let subtotal = 0;
    let hasPhysicalItem = false;
    const itemsForDB = [];

    // Calculate Prices
    for (const item of orderItems) {
      const book = await Book.findById(item.bookId);
      if (!book) return res.status(404).json({ message: `Book not found` });
      if (book.type === 'Physical') {
        hasPhysicalItem = true;
        if (book.stock < item.qty) return res.status(400).json({ message: `Insufficient stock for ${book.title}` });
      }
      subtotal += book.price * item.qty;
      itemsForDB.push({ book: book._id, name: book.title, qty: item.qty, price: book.price });
    }

    // Discount & Referral Logic
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

    // Totals
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round(taxableAmount * 0.05);
    const shipping = hasPhysicalItem ? 50 : 0; 
    const finalTotal = Math.round(taxableAmount + taxAmount + shipping);

    const uniqueOrderId = `BK-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;

    const order = await Order.create({
      orderId: uniqueOrderId,
      user: req.user._id,
      items: itemsForDB,
      priceBreakup: { subtotal, shipping, discountCode: appliedDiscountCode, discountAmount, taxAmount, referralApplied: appliedReferral?.code, total: finalTotal },
      shipping: { address: hasPhysicalItem ? shippingAddress : 'Digital Delivery', partner: 'Pending Assign' },
      status: 'Pending Payment',
      transitHistory: [{ stage: 'Order Placed (Awaiting Payment)', time: Date.now(), completed: true }]
    });

    sendEmail({ to: req.user.email, subject: `Order Initiated - #${order.orderId}`, html: templates.orderPlacedEmail(order, req.user.name) }).catch(console.error);
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5001';

    // Zero Amount Bypass
    if (finalTotal === 0) {
      await processSuccessfulPayment(order, 'DISC-100', '100% Discount');
      return res.status(201).json({ success: true, orderId: order.orderId, paymentPayload: { redirectUrl: `${frontendUrl}/payment-status/${order.orderId}` }});
    }

    // Initiate Gateway Payment via Service
    const payEnv = await PhonePeService.getEnvConfig(Config);
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

    res.status(201).json({ success: true, orderId: order.orderId, paymentPayload: { redirectUrl } });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/orders/verify-payment/:orderId
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
      await processSuccessfulPayment(order, data.transactionId, data.paymentInstrument?.type || 'Online');
    } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
      order.status = 'Failed';
      order.payment.status = 'Failed';
      await order.save();
    }
    
    return res.status(200).json({ status: order.status, paymentStatus: order.payment.status, code });

  } catch (error) {
    res.status(500).json({ message: 'Gateway error during verification', details: error.message });
  }
};

// @route   GET /api/orders/retry-payment/:orderId
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

// @route   POST /api/orders/webhook/phonepe
// @desc    Server-to-Server Webhook handler 
exports.phonepeWebhook = async (req, res) => {
  try {
    const { response } = req.body;
    const xVerifyHeader = req.headers['x-verify'];
    const payEnv = await PhonePeService.getEnvConfig(Config);

    // Verify Webhook Signature Integrity
    const expectedChecksum = PhonePeService.generateChecksum(response, '', payEnv.saltKey, payEnv.saltIndex);
    if (xVerifyHeader !== expectedChecksum) return res.status(400).send('Invalid Signature');

    const paymentData = JSON.parse(Buffer.from(response, 'base64').toString('utf8'));
    const order = await Order.findOne({ orderId: paymentData.data.merchantTransactionId });
    
    if (!order || order.status !== 'Pending Payment') return res.status(200).send('OK');

    if (paymentData.code === 'PAYMENT_SUCCESS') {
      await processSuccessfulPayment(order, paymentData.data.transactionId, paymentData.data.paymentInstrument?.type || 'Online Webhook');
    } else {
      order.status = 'Failed';
      order.payment.status = 'Failed';
      await order.save();
    }

    res.status(200).send('OK'); // Acknowledge receipt to stop PhonePe from retrying
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).send('Webhook Error');
  }
};

// @route   POST /api/orders/refund/:orderId
// @access  Admin Only
exports.refundOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order || order.payment.status !== 'Success') return res.status(400).json({ message: 'Invalid order state for refund' });

    const payEnv = await PhonePeService.getEnvConfig(Config);
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5001';

    const response = await PhonePeService.initiateRefund({
      originalTxnId: order.payment.txnId,
      amount: order.priceBreakup.total,
      userId: order.user,
      callbackUrl: `${apiUrl}/api/orders/webhook/phonepe`,
      env: payEnv
    });

    if (response.code === 'PAYMENT_SUCCESS' || response.code === 'PAYMENT_PENDING') {
      order.status = 'Cancelled';
      order.payment.status = 'Refunded';
      await order.save();
      res.status(200).json({ message: 'Refund initiated successfully', data: response });
    } else {
      res.status(400).json({ message: 'Refund failed at gateway' });
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