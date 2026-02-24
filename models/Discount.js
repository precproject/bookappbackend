const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  type: { type: String, enum: ['Percentage', 'Amount'], required: true },
  value: { type: Number, required: true },
  maxDiscount: { type: Number, required: true },
  validTill: { type: Date, default: null }, // Null means never expires
  maxUsage: { type: Number, default: null }, // Null means unlimited
  currentUsage: { type: Number, default: 0 },
  status: { type: String, enum: ['Active', 'Expired'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Discount', discountSchema);