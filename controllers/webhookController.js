const crypto = require('crypto');
const Order = require('../models/Order');
const Book = require('../models/Book');
const Referral = require('../models/Referral');
const Config = require('../models/Config'); // <-- Added Config Import
const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const { processSuccessfulPayment } = require('../services/orderService');

const crypto = require('crypto');
const Order = require('../models/Order');
const Config = require('../models/Config');
const { processSuccessfulPayment } = require('../services/orderService');

// @route   POST /api/webhooks/phonepe
// @desc    Receive Server-to-Server (S2S) payment updates from PhonePe
exports.phonepeWebhook = async (req, res) => {
  try {
    const phonepeResponse = req.body.response; // The base64 string
    const providedChecksum = req.headers['x-verify'];

    // 1. Validate payload exists
    if (!phonepeResponse || !providedChecksum) {
      console.warn('[PhonePe Webhook] Missing payload or checksum header');
      return res.status(400).send('Bad Request');
    }

    // 2. Fetch dynamic configuration
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const saltKey = config?.payment?.saltKey || process.env.PHONEPE_SALT_KEY;

    if (!saltKey) {
      console.error('[PhonePe Webhook] Server Payment Configuration Missing');
      return res.status(500).send('Server Config Error');
    }

    // --- ENHANCEMENT 1: Robust Checksum Verification ---
    // Formula: SHA256(base64Response + saltKey) + "###" + saltIndex
    const stringToHash = phonepeResponse + saltKey;
    const expectedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    
    // Split the provided header to isolate the hash (ignoring the index for strict comparison)
    const [receivedHash] = providedChecksum.split('###');

    if (receivedHash !== expectedHash) {
      console.error('[PhonePe Webhook] SECURITY ALERT: Invalid Checksum Signature');
      return res.status(400).send('Invalid Signature');
    }

    // --- FIX 2: Correct Payload Destructuring ---
    const decodedPayload = JSON.parse(Buffer.from(phonepeResponse, 'base64').toString('utf-8'));
    
    // Extract `code` and `success` from the ROOT, and IDs from `data`
    const { code, success } = decodedPayload; 
    const { merchantTransactionId, transactionId } = decodedPayload.data || {};

    if (!merchantTransactionId) {
      console.error('[PhonePe Webhook] Missing merchantTransactionId in decoded payload');
      return res.status(400).send('Invalid Payload Format');
    }

    // 3. Find the Order
    const order = await Order.findOne({ orderId: merchantTransactionId }).populate('user', 'name email');
    if (!order) {
      console.error(`[PhonePe Webhook] Order #${merchantTransactionId} not found in DB`);
      return res.status(404).send('Order not found');
    }

    // --- ENHANCEMENT 3: Idempotency (Prevent Double Processing) ---
    // PhonePe often sends the exact same webhook 2-3 times. 
    // We must return 200 OK immediately if we already marked it as Success.
    if (order.payment?.status === 'Success' || order.status === 'In Progress' || order.status === 'Delivered') {
      console.log(`[PhonePe Webhook] Order #${merchantTransactionId} already processed.`);
      return res.status(200).send('OK'); 
    }

    const io = req.app.get('io');

    // 4. Handle Success or Failure
    if (success && code === 'PAYMENT_SUCCESS') {
      
      // Safely process inventory, referrals, and emails
      await processSuccessfulPayment(order, transactionId, 'PhonePe', config);
      
      // Update Real-Time UI
      if (io) io.to(order.orderId).emit('paymentStatusUpdate', { status: 'Success', orderId: order.orderId });
      console.log(`[PhonePe Webhook] Order #${merchantTransactionId} Payment SUCCESS`);

    } else {
      
      // Handle Failed, Cancelled, or Pending states
      order.status = 'Failed';
      order.payment.status = 'Failed';
      order.payment.updatedAt = Date.now();
      await order.save();
      
      if (io) io.to(order.orderId).emit('paymentStatusUpdate', { status: 'Failed', orderId: order.orderId });
      console.log(`[PhonePe Webhook] Order #${merchantTransactionId} Payment FAILED (Code: ${code})`);
      
    }

    // PhonePe REQUIRES a 200 OK response, otherwise they will keep retrying
    res.status(200).send('OK');

  } catch (error) {
    console.error('[PhonePe Webhook Error]:', error);
    // Return 500 so PhonePe knows something broke on our end and retries the webhook later
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