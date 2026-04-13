const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
const Book = require('../models/Book');
const Referral = require('../models/Referral');
const Config = require('../models/Config');
const PhonePeService = require('../services/phonepeService');

const startCronJobs = () => {
  console.log('⏳ Store Manager (Cron Jobs) Initialized.');

  // ====================================================================
  // JOB 1: DATABASE BACKUP (2:00 AM)
  // ====================================================================
  cron.schedule('0 2 * * *', () => {
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const file = path.join(backupDir, `backup-${new Date().toISOString().split('T')[0]}.gzip`);
    const dumpCommand = `mongodump --uri="${process.env.MONGO_URI}" --archive="${file}" --gzip`;

    exec(dumpCommand, (error) => {
      if (error) return console.error(`[CRON] Backup Failed: ${error.message}`);
      console.log(`[CRON] Backup Successful: ${file}`);

      // Cleanup files older than 7 days
      fs.readdir(backupDir, (err, files) => {
        if (err) return;
        const expiry = Date.now() - (7 * 24 * 60 * 60 * 1000);
        files.forEach(f => {
          const fPath = path.join(backupDir, f);
          if (fs.statSync(fPath).mtimeMs < expiry) fs.unlinkSync(fPath);
        });
      });
    });
  });

  // ====================================================================
  // JOB 2: PAYMENT SWEEPER (Every 15 mins)
  // ====================================================================
  cron.schedule('*/15 * * * *', async () => {
    try {
      const twentyMinsAgo = new Date(Date.now() - 20 * 60000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000); // Don't sweep ancient orders
      
      const pendingOrders = await Order.find({
        status: 'Pending Payment',
        createdAt: { $lt: twentyMinsAgo, $gt: oneDayAgo }
      });

      if (pendingOrders.length === 0) return;

      // Fetch config using your Schema's singletonId
      const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
      const payEnv = systemConfig?.payment;

      if (!payEnv || !payEnv.merchantId) return;

      for (let order of pendingOrders) {
        try {
          const { code, data } = await PhonePeService.checkStatus({ 
            orderId: order.orderId, 
            env: payEnv 
          });

          if (code === 'PAYMENT_SUCCESS') {
            // 1. Update Order Status
            order.status = 'In Progress';
            order.payment.status = 'Success';
            order.payment.txnId = data?.transactionId || 'RECOVERED';
            order.payment.updatedAt = new Date();
            
            order.transitHistory.push({ 
              stage: 'Payment Verified (Auto-Recovery)', 
              time: new Date(), 
              completed: true 
            });

            // 2. Atomic Inventory Deduction (Schema Sync: Physical vs Digital)
            for (const item of order.items) {
              if (item.type === 'Physical') {
                const updatedBook = await Book.findOneAndUpdate(
                  { _id: item.book, stock: { $gte: item.qty } },
                  { $inc: { stock: -item.qty } },
                  { new: true }
                );

                if (updatedBook) {
                  updatedBook.history.unshift({
                    type: 'Deduction',
                    reason: `Order #${order.orderId} (Auto-Recovered)`,
                    change: -item.qty,
                    balance: updatedBook.stock
                  });
                  await updatedBook.save();
                } else {
                  order.status = 'Cancelled'; // Or flag for admin review
                  order.notes = (order.notes || '') + " [RECOVERY ALERT: Out of stock]";
                }
              }
            }

            // 3. Referral Update (Schema Sync: rewardRate, totalEarned, pendingPayout)
            if (order.priceBreakup.referralApplied) {
              const refDoc = await Referral.findOne({ code: order.priceBreakup.referralApplied });
              // Check if txn already exists to prevent duplicates
              const isAlreadyAdded = refDoc?.transactions.some(t => t.order.toString() === order._id.toString());

              if (refDoc && !isAlreadyAdded) {
                refDoc.uses += 1;
                refDoc.totalEarned += refDoc.rewardRate;
                refDoc.pendingPayout += refDoc.rewardRate;
                refDoc.transactions.push({
                  order: order._id,
                  earnedAmount: refDoc.rewardRate,
                  payoutStatus: 'Pending',
                  date: new Date()
                });
                await refDoc.save();
              }
            }
          } 
          else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
            order.status = 'Cancelled';
            order.payment.status = 'Failed';
          }
          
          await order.save();

        } catch (err) {
          if (err.response?.status === 404) {
            order.status = 'Cancelled';
            order.payment.status = 'Failed';
            await order.save();
          }
        }
      }
    } catch (error) {
      console.error('[CRON] Sweeper Error:', error);
    }
  });
};

module.exports = startCronJobs;