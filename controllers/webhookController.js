const crypto = require('crypto');
const Order = require('../models/Order');
const Book = require('../models/Book');
const Referral = require('../models/Referral');
const Config = require('../models/Config'); // <-- Added Config Import
const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const { processSuccessfulPayment } = require('../services/orderService');

// @route   POST /api/webhooks/phonepe
// @desc    Receive payment update from PhonePe
exports.phonepeWebhook = async (req, res) => {
  try {
    const phonepeResponse = req.body.response; 
    const providedChecksum = req.headers['x-verify'];
    
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    
    // Read directly from config (No Encryption)
    const saltKey = config?.payment?.saltKey || process.env.PHONEPE_SALT_KEY;
    const saltIndex = config?.payment?.saltIndex || 1;

    if (!saltKey) {
      return res.status(500).json({ success: false, message: 'Server Payment Configuration Missing' });
    }
    
    // Security Verification
    const expectedChecksum = crypto.createHash('sha256').update(phonepeResponse + saltKey).digest('hex') + "###" + saltIndex;
    if (providedChecksum !== expectedChecksum) {
      return res.status(400).json({ success: false, message: 'Invalid Signature' });
    }

    const decodedPayload = JSON.parse(Buffer.from(phonepeResponse, 'base64').toString('utf-8'));
    const { merchantTransactionId, transactionId, code } = decodedPayload.data;

    const order = await Order.findOne({ orderId: merchantTransactionId }).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const io = req.app.get('io');

    if (code === 'PAYMENT_SUCCESS') {
      await processSuccessfulPayment(order, transactionId, 'PhonePe', config);
      if (io) io.to(order.orderId).emit('paymentStatusUpdate', { status: 'Success', orderId: order.orderId });
    } else {
      order.status = 'Failed';
      order.payment.status = 'Failed';
      order.payment.updatedAt = Date.now();
      await order.save();
      if (io) io.to(order.orderId).emit('paymentStatusUpdate', { status: 'Failed', orderId: order.orderId });
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
    const { waybill, current_status, status_dateTime, location } = req.body;

    const order = await Order.findOne({ 'shipping.trackingId': waybill }).populate('user', 'email');
    if (!order) return res.status(404).json({ message: 'Tracking ID not found' });

    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });

    // Store minimal status string (Memory Optimized)
    order.shipping.awbStatus = `${current_status} - ${location}`;

    const statusLower = current_status.toLowerCase();
    
    if (statusLower.includes('delivered') && order.status !== 'Delivered') {
      order.status = 'Delivered';
      order.transitHistory.push({ stage: 'Package Delivered', time: new Date(status_dateTime), completed: true });
      
      if (config?.emailAlerts?.orderDelivered !== false) {
        sendEmail({ to: order.user.email, subject: `तुमची ऑर्डर पोहोचली! - #${order.orderId} | Order Delivered`, html: templates.deliverySuccessEmail(order.orderId) }).catch(console.error);
      }
    } 
    else if ((statusLower.includes('dispatched') || statusLower.includes('in transit')) && !order.shipping.isDispatchedAlertSent) {
      order.shipping.isDispatchedAlertSent = true; 
      
      if (config?.emailAlerts?.orderDispatched !== false) {
        sendEmail({ to: order.user.email, subject: `तुमची ऑर्डर पाठवली आहे! - #${order.orderId} | Order Dispatched`, html: templates.orderDispatchedEmail(order.orderId, order.shipping.trackingId, order.shipping.partner) }).catch(console.error);
      }
    }

    await order.save();
    res.status(200).json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Delivery Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
};