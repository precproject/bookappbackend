const crypto = require('crypto');
const Order = require('../models/Order');
const Book = require('../models/Book');
const Referral = require('../models/Referral');
const Config = require('../models/Config'); // <-- Added Config Import

// @route   POST /api/webhooks/phonepe
// @desc    Receive payment update from PhonePe
exports.phonepeWebhook = async (req, res) => {
  try {
    const phonepeResponse = req.body.response; 
    const providedChecksum = req.headers['x-verify'];
    
    // Fetch Dynamic Configuration
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const payConfig = config ? config.payment : null;

    const saltKey = payConfig?.saltKey || process.env.PHONEPE_SALT_KEY;
    const saltIndex = payConfig?.saltIndex || 1;

    if (!saltKey) {
      return res.status(500).json({ success: false, message: 'Server Payment Configuration Missing' });
    }
    
    const expectedChecksum = crypto.createHash('sha256').update(phonepeResponse + saltKey).digest('hex') + "###" + saltIndex;

    if (providedChecksum !== expectedChecksum) {
      return res.status(400).json({ success: false, message: 'Invalid Signature' });
    }

    const decodedPayload = JSON.parse(Buffer.from(phonepeResponse, 'base64').toString('utf-8'));
    const { merchantTransactionId, transactionId, code } = decodedPayload.data;

    const order = await Order.findOne({ orderId: merchantTransactionId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (code === 'PAYMENT_SUCCESS') {
      order.status = 'In Progress'; 
      order.payment.status = 'Success';
      order.payment.txnId = transactionId;
      order.payment.updatedAt = Date.now();
      
      order.transitHistory.push({ stage: 'Payment Verified', time: Date.now(), completed: true });
      order.transitHistory.push({ stage: 'Ready for Dispatch', time: Date.now(), completed: true });

      await order.save();

      // Deduct Inventory
      for (const item of order.items) {
        const book = await Book.findById(item.book);
        if (book && book.type === 'Physical' && book.stock > 0) {
          book.stock -= item.qty;
          book.history.unshift({ type: 'Deduction', reason: `Order #${order.orderId}`, change: -item.qty, balance: book.stock });
          await book.save();
        }
      }

      // Credit Referral
      if (order.priceBreakup.referralApplied) {
        const referral = await Referral.findOne({ code: order.priceBreakup.referralApplied });
        if (referral && referral.status === 'Active') {
          referral.uses += 1;
          referral.totalEarned += referral.rewardRate;
          referral.pendingPayout += referral.rewardRate;
          // Add this order to referral transactions
          referral.transactions = referral.transactions || [];
          referral.transactions.push(order._id);
          await referral.save();
        }
      }

      req.app.get('io').to(order.orderId).emit('paymentStatusUpdate', { status: 'Success', orderId: order.orderId });

    } else {
      order.status = 'Failed';
      order.payment.status = 'Failed';
      order.payment.updatedAt = Date.now();
      await order.save();

      req.app.get('io').to(order.orderId).emit('paymentStatusUpdate', { status: 'Failed', message: 'Payment failed' });
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('PhonePe Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// @route   POST /api/webhooks/delivery
// @desc    Receive tracking update from Delhivery/Shiprocket
exports.deliveryWebhook = async (req, res) => {
  try {
    // Assuming standard logistics payload structure
    const { waybill, current_status, status_dateTime, location } = req.body;

    const order = await Order.findOne({ 'shipping.trackingId': waybill });
    if (!order) return res.status(404).json({ message: 'Tracking ID not found in system' });

    // Map logistics status to our system status
    let mappedStage = current_status; 
    let orderStatus = order.status;

    if (current_status.toLowerCase().includes('delivered')) {
      mappedStage = 'Delivered';
      orderStatus = 'Success';
    } else if (current_status.toLowerCase().includes('transit') || current_status.toLowerCase().includes('dispatched')) {
      mappedStage = `In Transit - ${location}`;
      orderStatus = 'In Progress';
    }

    order.status = orderStatus;
    order.transitHistory.push({
      stage: mappedStage,
      time: new Date(status_dateTime),
      completed: true
    });

    await order.save();
    res.status(200).json({ success: true, message: 'Transit history updated' });

  } catch (error) {
    console.error('Delivery Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};