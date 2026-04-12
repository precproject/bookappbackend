const Book = require('../models/Book');
const Referral = require('../models/Referral');
const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const delhiveryService = require('../services/delhiveryService'); // <-- Import Delhivery


// --- THE CASHIER COMPLETES THE SALE ---
exports.processSuccessfulPayment = async (order, transactionId, paymentMethod, config) => {
  if (order.status !== 'Pending Payment') return; 

  order.status = 'In Progress';
  order.payment.status = 'Success';
  order.payment.txnId = transactionId;
  order.payment.method = paymentMethod;
  order.payment.updatedAt = Date.now();
  
  order.transitHistory.push({ stage: 'Payment Verified', time: Date.now(), completed: true });

  let hasPhysicalItems = false;

  // 1. Atomic Inventory Deduction (Prevents Race Conditions)
  for (const item of order.items) {
    if (item.type === 'Physical') {
      hasPhysicalItems = true;
      const updatedBook = await Book.findOneAndUpdate(
        { _id: item.book, type: 'Physical', stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
        { new: true }
      );
      
      if (updatedBook) {
        updatedBook.history.unshift({ type: 'Deduction', reason: `Order #${order.orderId}`, change: -item.qty, balance: updatedBook.stock });
        await updatedBook.save();
      } else {
        order.notes = (order.notes || '') + ` [System Note: Stock ran out for ${item.name} during checkout.]`;
      }
    }
  }

  // 2. Credit Referral
  if (order.priceBreakup.referralApplied) {
    const refDoc = await Referral.findOne({ code: order.priceBreakup.referralApplied });
    if (refDoc && refDoc.status === 'Active') {
      refDoc.uses += 1;
      refDoc.totalEarned += refDoc.rewardRate;
      refDoc.pendingPayout += refDoc.rewardRate;
      refDoc.transactions = refDoc.transactions || [];
      refDoc.transactions.push({
        order: order._id,
        earnedAmount: refDoc.rewardRate,
        payoutStatus: 'Pending',
        date: Date.now()
      });
      await refDoc.save();
    }
  }

  // 3. Automate Delhivery AWB
  if (hasPhysicalItems) {
    await order.populate('items.book'); 
    
    // Calls your Delhivery Service directly
    const shipment = await delhiveryService.createShipment(order, order.items);
    
    if (shipment.success) {
      order.shipping.partner = 'Delhivery';
      order.shipping.trackingId = shipment.awb;
      order.shipping.awbStatus = shipment.status; 
      if (shipment.estimatedDelivery) order.shipping.estimatedDelivery = new Date(shipment.estimatedDelivery);
      order.transitHistory.push({ stage: `Shipment Created (AWB: ${shipment.awb})`, time: Date.now(), completed: true });
    } else {
      order.notes = (order.notes || '') + ` [Delhivery Error: ${shipment.error}. Requires manual AWB generation.]`;
    }
  }

  await order.save();

  // 4. Send Receipt using config toggle
  if (config?.emailAlerts?.paymentSuccess !== false) {
    sendEmail({ 
      to: order.user.email, 
      subject: `Payment Confirmed - #${order.orderId}`, 
      html: templates.paymentSuccessEmail(order, order.user.name) 
    }).catch(console.error);
  }
};