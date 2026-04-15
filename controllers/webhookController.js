const crypto = require('crypto');
const Order = require('../models/Order');
const Config = require('../models/Config');
const { processSuccessfulPayment } = require('../services/orderService');

// @route   POST /api/webhooks/phonepe
// @desc    Receive PhonePe V2 Webhook Events (S2S Callback)
exports.phonepeWebhook = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const { event, payload } = req.body;

    // 1. Fetch Webhook Auth Config from DB/Env
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const webhookUser = config?.payment?.webhookUsername || process.env.PHONEPE_WEBHOOK_USER;
    const webhookPass = config?.payment?.webhookPassword || process.env.PHONEPE_WEBHOOK_PASS;

    if (!webhookUser || !webhookPass) {
      console.error('[PhonePe V2 Webhook] Missing Webhook Credentials in Server Config');
      return res.status(500).send('Server Configuration Error');
    }

    // 2. Validate Authorization Header (SHA256 of username:password)
    const expectedHash = crypto.createHash('sha256').update(`${webhookUser}:${webhookPass}`).digest('hex');
    
    if (authHeader !== expectedHash && authHeader !== `SHA256(${expectedHash})`) {
      console.error('[PhonePe V2 Webhook] SECURITY ALERT: Invalid Webhook Authentication');
      return res.status(401).send('Unauthorized Signature');
    }

    // 3. Process Event Data
    if (!event || !payload) {
      return res.status(400).send('Invalid Webhook Body');
    }

    // PhonePe recommends filtering by exact event type
    if (event !== 'checkout.order.completed' && event !== 'checkout.order.failed') {
      return res.status(200).send('Event Ignored'); // Acknowledge safely
    }

    // Per documentation: Rely only on root-level payload.state
    const { merchantOrderId, state } = payload;

    if (!merchantOrderId) {
      return res.status(400).send('Missing Order ID in Payload');
    }

    // 4. Find the Order in Database
    const order = await Order.findOne({ orderId: merchantOrderId }).populate('user', 'name email');
    
    if (!order) {
      console.error(`[PhonePe V2 Webhook] Order #${merchantOrderId} not found`);
      return res.status(404).send('Order not found');
    }

    // 5. Idempotency Check (PhonePe often sends duplicates)
    if (order.payment?.status === 'Success' || order.status === 'In Progress' || order.status === 'Delivered') {
      console.log(`[PhonePe V2 Webhook] Order #${merchantOrderId} already processed.`);
      return res.status(200).send('OK'); 
    }

    const io = req.app.get('io');

    // 6. Handle State changes based on 'state' string
    if (state === 'COMPLETED') {
      
      // Update inventory, referral rewards, and send emails
      await processSuccessfulPayment(order, payload.transactionId || merchantOrderId, 'PhonePe', config);
      
      if (io) io.to(order.orderId).emit('paymentStatusUpdate', { status: 'Success', orderId: order.orderId });
      console.log(`[PhonePe V2 Webhook] Order #${merchantOrderId} Payment COMPLETED`);

    } else if (state === 'FAILED') {
      
      order.status = 'Failed';
      order.payment.status = 'Failed';
      order.payment.updatedAt = Date.now();
      await order.save();
      
      if (io) io.to(order.orderId).emit('paymentStatusUpdate', { status: 'Failed', orderId: order.orderId });
      console.log(`[PhonePe V2 Webhook] Order #${merchantOrderId} Payment FAILED`);
      
    }

    // MUST return 2xx status code immediately so PhonePe doesn't retry
    res.status(200).send('OK');

  } catch (error) {
    console.error('[PhonePe V2 Webhook Error]:', error);
    res.status(500).send('Internal Server Error');
  }
};