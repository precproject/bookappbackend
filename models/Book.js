const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  type: { type: String, enum: ['Addition', 'Deduction', 'Creation', 'Adjustment'], required: true },
  reason: { type: String, required: true },
  change: { type: Number }, // Null for digital
  balance: { type: mongoose.Schema.Types.Mixed }, // Number or '∞'
  date: { type: Date, default: Date.now }
});

const bookSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['Physical', 'Digital'], required: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: null }, // Null means infinite (Digital)
  weightInGrams: { type: Number, default: 500 }, // <--- CRITICAL FOR DELHIVERY
  coverImage: { type: String, default: '' },
  rating: { type: Number, default: 0 },
  history: [historySchema]
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);