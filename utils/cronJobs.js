const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises; // Use async file system operations
const Order = require('../models/Order');
const Book = require('../models/Book');
const Referral = require('../models/Referral');
const Config = require('../models/Config');
const PhonePeService = require('../services/phonepeService');

// State lock to prevent overlapping Sweeper runs
let isSweeperRunning = false;

// Helper to delay loops and let the Node.js Event Loop breathe
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const startCronJobs = () => {
  console.log('⏳ Store Manager (Cron Jobs) Initialized.');

  // ====================================================================
  // JOB 1: DATABASE BACKUP (2:00 AM)
  // ====================================================================
  cron.schedule('0 2 * * *', async () => {
    try {
      const backupDir = path.join(__dirname, '../backups');
      
      // Async directory creation
      if (!fs.existsSync(backupDir)) {
        await fsPromises.mkdir(backupDir, { recursive: true });
      }

      const file = path.join(backupDir, `backup-${new Date().toISOString().split('T')[0]}.gzip`);
      const dumpCommand = `mongodump --uri="${process.env.MONGO_URI}" --archive="${file}" --gzip`;

      exec(dumpCommand, async (error) => {
        if (error) return console.error(`[CRON] Backup Failed: ${error.message}`);
        console.log(`[CRON] Backup Successful: ${file}`);

        // NON-BLOCKING Cleanup: Delete files older than 7 days
        try {
          const files = await fsPromises.readdir(backupDir);
          const expiry = Date.now() - (7 * 24 * 60 * 60 * 1000);
          
          for (const f of files) {
            const fPath = path.join(backupDir, f);
            const stats = await fsPromises.stat(fPath); // Async stat
            
            if (stats.mtimeMs < expiry) {
              await fsPromises.unlink(fPath); // Async delete
              console.log(`[CRON] Deleted old backup: ${f}`);
            }
          }
        } catch (cleanupErr) {
          console.error(`[CRON] Backup Cleanup Failed:`, cleanupErr);
        }
      });
    } catch (err) {
      console.error(`[CRON] Backup Process Error:`, err);
    }
  });

  // ====================================================================
  // JOB 2: PAYMENT SWEEPER (Every 15 mins)
  // ====================================================================
  cron.schedule('*/15 * * * *', async () => {
    // 1. CONCURRENCY LOCK: Prevent overlap if the previous job is still running
    if (isSweeperRunning) {
      console.log('[CRON] Sweeper is already running. Skipping this cycle to prevent CPU spike.');
      return; 
    }

    isSweeperRunning = true;

    try {
      const twentyMinsAgo = new Date(Date.now() - 20 * 60000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000);
      
      // 2. CHUNK LIMIT: Process a maximum of 50 orders at a time to prevent RAM exhaustion
      const pendingOrders = await Order.find({
        status: 'Pending Payment',
        createdAt: { $lt: twentyMinsAgo, $gt: oneDayAgo }
      }).limit(50);

      if (pendingOrders.length === 0) return;
      console.log(`[CRON] Sweeper found ${pendingOrders.length} pending orders to verify.`);

      // 3. V2 UPGRADE: Fetch the proper V2 Environment Configuration
      const payEnv = await PhonePeService.getEnvConfig(Config);
      
      if (!payEnv || !payEnv.clientId) {
        console.error('[CRON] Payment Sweeper aborted: V2 Client ID missing.');
        return;
      }

      for (let order of pendingOrders) {
        try {
          // V2 Status Check API
          const statusResponse = await PhonePeService.checkStatus({ 
            orderId: order.orderId, 
            env: payEnv 
          });

          // 4. V2 UPGRADE: Check 'state' instead of 'code'
          if (statusResponse.state === 'COMPLETED') {
            
            order.status = 'In Progress';
            order.payment.status = 'Success';
            // V2 Safely extract Transaction ID
            order.payment.txnId = statusResponse.paymentDetailsList?.[0]?.transactionId || 'RECOVERED';
            order.payment.updatedAt = new Date();
            
            order.transitHistory.push({ 
              stage: 'Payment Verified (Auto-Recovery)', 
              time: new Date(), 
              completed: true 
            });

            // Atomic Inventory Deduction
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
                  order.status = 'Cancelled'; 
                  order.notes = (order.notes || '') + " [RECOVERY ALERT: Out of stock]";
                }
              }
            }

            // Referral Update
            if (order.priceBreakup.referralApplied) {
              const refDoc = await Referral.findOne({ code: order.priceBreakup.referralApplied });
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
          else if (statusResponse.state === 'FAILED') {
            order.status = 'Cancelled';
            order.payment.status = 'Failed';
          }
          
          await order.save();

          // 5. EVENT LOOP BREATHER: Wait 200ms between orders to prevent CPU blocking & API Rate Limiting
          await delay(200);

        } catch (err) {
          if (err.response?.status === 404 || err.response?.data?.code === 'BAD_REQUEST') {
            // Order was never initialized on PhonePe's end (user closed browser early)
            order.status = 'Cancelled';
            order.payment.status = 'Failed';
            await order.save();
          }
        }
      }
    } catch (error) {
      console.error('[CRON] Sweeper Error:', error);
    } finally {
      // RELEASE THE LOCK regardless of success or failure
      isSweeperRunning = false;
    }
  });
};

module.exports = startCronJobs;