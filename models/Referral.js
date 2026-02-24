const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  rewardRate: { type: Number, required: true, default: 50 }, 
  uses: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  pendingPayout: { type: Number, default: 0 },
  isDiscountLinked: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' },
  // ADDED: This tracks which orders successfully used this code
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }] 
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);