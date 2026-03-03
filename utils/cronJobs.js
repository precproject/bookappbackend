const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
const Book = require('../models/Book');
const Referral = require('../models/Referral');
const Config = require('../models/Config');
const PhonePeService = require('./phonepeService'); // Re-using your existing service!

const startCronJobs = () => {
  console.log('⏳ Store Manager (Cron Jobs) Initialized.');

  // ====================================================================
  // JOB 1: THE NIGHTLY LEDGER PHOTOCOPY (Database Backup at 2:00 AM)
  // ====================================================================
  cron.schedule('0 2 * * *', () => {
    console.log('[CRON] Starting Nightly Database Backup...');
    
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const date = new Date().toISOString().split('T')[0];
    const backupFile = path.join(backupDir, `backup-${date}.gzip`);
    const dbUri = process.env.MONGO_URI; 

    // Note: Your server needs 'mongodatabase-tools' installed for this to run
    const dumpCommand = `mongodump --uri="${dbUri}" --archive="${backupFile}" --gzip`;

    exec(dumpCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`[CRON] Backup Failed: ${error.message}`);
        return;
      }
      console.log(`[CRON] Backup Successful: ${backupFile}`);

      // Throw away copies older than 7 days so the server doesn't get full
      fs.readdir(backupDir, (err, files) => {
        if (err) return;
        
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        files.forEach(file => {
          const filePath = path.join(backupDir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.mtimeMs < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            console.log(`[CRON] Deleted old backup: ${file}`);
          }
        });
      });
    });
  });

  // ====================================================================
  // JOB 2: THE CASHIER AUDIT (Pending Payment Sweeper - Every 15 mins)
  // ====================================================================
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Running the Cashier Audit (Payment Sweeper)...');
    try {
      // Look for customers who have been standing at the billing counter for more than 20 mins
      const twentyMinsAgo = new Date(Date.now() - 20 * 60000);
      
      const pendingOrders = await Order.find({
        status: 'Pending Payment',
        createdAt: { $lt: twentyMinsAgo }
      });

      if (pendingOrders.length === 0) return;

      // Get the current shop payment rules
      const payEnv = await PhonePeService.getEnvConfig(Config);
      if (!payEnv || !payEnv.merchantId) {
        console.error('[CRON] Audit paused: Card machine (PhonePe) settings are missing.');
        return;
      }

      for (let order of pendingOrders) {
        try {
          // Ask PhonePe: "Did this specific order ID actually go through?"
          const { code, data } = await PhonePeService.checkStatus({ orderId: order.orderId, env: payEnv });

          if (code === 'PAYMENT_SUCCESS') {
            console.log(`[CRON] Found a lost successful payment for Order ${order.orderId}! Fixing it now...`);
            
            // 1. Update the receipt
            order.status = 'In Progress';
            order.payment.status = 'Success';
            if (data && data.transactionId) order.payment.txnId = data.transactionId;
            order.payment.method = data.paymentInstrument?.type || 'Auto-Recovery';
            order.transitHistory.push({ stage: 'Payment Verified (Auto-Recovery)', time: Date.now(), completed: true });
            
            // 2. CRITICAL: Take the book off the physical shelf!
            for (const item of order.items) {
              const book = await Book.findOne({ _id: item.book, type: 'Physical', stock: { $gte: item.qty } });
              if (book) {
                book.stock -= item.qty;
                book.history.unshift({ type: 'Deduction', reason: `Order #${order.orderId} (Auto-Recovered)`, change: -item.qty, balance: book.stock });
                await book.save();
              } else {
                order.notes = (order.notes || '') + ` [System Note: Recovered payment, but book ran out of stock!]`;
              }
            }

            // 3. Give the friend their referral reward
            if (order.priceBreakup.referralApplied) {
              const refDoc = await Referral.findOne({ code: order.priceBreakup.referralApplied });
              if (refDoc) {
                refDoc.uses += 1;
                refDoc.totalEarned += refDoc.rewardRate;
                refDoc.pendingPayout += refDoc.rewardRate;
                refDoc.transactions.push({ order: order._id, earnedAmount: refDoc.rewardRate, payoutStatus: 'Pending', date: Date.now() });
                await refDoc.save();
              }
            }

          } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
             // The card declined. Mark it as failed.
             order.status = 'Cancelled'; // User abandoned a failed payment
             order.payment.status = 'Failed';
             order.notes = (order.notes || '') + ' [System Note: Payment officially failed on PhonePe.]';
          }
          
          await order.save();

        } catch (apiError) {
          // If PhonePe says "404 Not Found", it means the customer never even typed their UPI PIN. 
          // They just closed the browser.
          if (apiError.response && apiError.response.status === 404) {
            console.log(`[CRON] Order ${order.orderId} was abandoned by the customer. Cancelling order.`);
            order.status = 'Cancelled';
            order.payment.status = 'Failed';
            order.notes = (order.notes || '') + ' [System Note: Customer abandoned checkout. Cancelled by Sweeper.]';
            await order.save();
          }
        }
      }
    } catch (error) {
      console.error('[CRON] Cashier Audit ran into a problem:', error);
    }
  });
};

module.exports = startCronJobs;