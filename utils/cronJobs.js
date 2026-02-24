const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/Order');
const Config = require('../models/Config');

// Helper to get dynamic PhonePe keys
const getPaymentConfig = async () => {
  const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
  return config ? config.payment : null;
};

const startCronJobs = () => {
  console.log('Cron Jobs Initialized.');

  // ====================================================================
  // JOB 1: AUTOMATED DATABASE BACKUP (Runs every day at 2:00 AM)
  // ====================================================================
  cron.schedule('0 2 * * *', () => {
    console.log('[CRON] Starting Database Backup...');
    
    // Ensure backups directory exists
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

    const date = new Date().toISOString().split('T')[0];
    const backupFile = path.join(backupDir, `backup-${date}.gzip`);
    const dbUri = process.env.MONGO_URI; 

    // Uses MongoDB database tools to dump and compress
    const dumpCommand = `mongodump --uri="${dbUri}" --archive="${backupFile}" --gzip`;

    exec(dumpCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`[CRON] Backup Failed: ${error.message}`);
        return;
      }
      console.log(`[CRON] Backup Successful: ${backupFile}`);

      // Cleanup old backups (keep last 7 days)
      fs.readdir(backupDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
          const filePath = path.join(backupDir, file);
          const stat = fs.statSync(filePath);
          const now = new Date().getTime();
          const endTime = new Date(stat.ctime).getTime() + 7 * 24 * 60 * 60 * 1000; // 7 days
          if (now > endTime) {
            fs.unlinkSync(filePath);
            console.log(`[CRON] Deleted old backup: ${file}`);
          }
        });
      });
    });
  });

  // ====================================================================
  // JOB 2: PENDING PAYMENT SWEEPER (Runs every 15 minutes)
  // ====================================================================
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Running Pending Payment Sweeper...');
    try {
      // Find orders that have been 'Pending Payment' for more than 20 minutes
      const twentyMinsAgo = new Date(Date.now() - 20 * 60000);
      
      const pendingOrders = await Order.find({
        status: 'Pending Payment',
        createdAt: { $lt: twentyMinsAgo }
      });

      if (pendingOrders.length === 0) return;

      const payConfig = await getPaymentConfig();
      if (!payConfig || !payConfig.merchantId) {
        console.error('[CRON] Cannot check payment status: Merchant ID missing in Config.');
        return;
      }

      // Base URL based on Environment mapped from .env
      const baseUrl = payConfig.isLiveMode 
        ? process.env.PHONEPE_LIVE_URL 
        : process.env.PHONEPE_UAT_URL;

      for (let order of pendingOrders) {
        // Construct standard PhonePe Check Status Checksum
        // SHA256("/pg/v1/status/{merchantId}/{merchantTransactionId}" + saltKey) + "###" + saltIndex
        const endpoint = `/pg/v1/status/${payConfig.merchantId}/${order.orderId}`;
        const checksum = crypto.createHash('sha256').update(endpoint + payConfig.saltKey).digest('hex') + "###" + payConfig.saltIndex;

        try {
          const response = await axios.get(`${baseUrl}${endpoint}`, {
            headers: {
              'Content-Type': 'application/json',
              'X-VERIFY': checksum,
              'X-MERCHANT-ID': payConfig.merchantId
            }
          });

          const { code, data } = response.data;

          if (code === 'PAYMENT_SUCCESS') {
            console.log(`[CRON] Order ${order.orderId} was successful but missed webhook. Updating...`);
            order.status = 'In Progress';
            order.payment.status = 'Success';
            if (data && data.transactionId) order.payment.txnId = data.transactionId;
            order.transitHistory.push({ stage: 'Payment Verified (Auto-Recovery)', time: Date.now(), completed: true });
            
            // NOTE: In a full app, you'd also call the inventory deduction logic here.
          } else if (code === 'PAYMENT_ERROR' || code === 'INTERNAL_SERVER_ERROR') {
             // If phonepe explicitly says it failed
             order.status = 'Failed';
             order.payment.status = 'Failed';
          }
          await order.save();
        } catch (apiError) {
          // If 404, it means the user never even opened the PhonePe page. Expire the order.
          if (apiError.response && apiError.response.status === 404) {
            console.log(`[CRON] Order ${order.orderId} expired (user dropped off).`);
            order.status = 'Failed';
            order.payment.status = 'Failed';
            await order.save();
          }
        }
      }
    } catch (error) {
      console.error('[CRON] Payment Sweeper Error:', error);
    }
  });
};

module.exports = startCronJobs;