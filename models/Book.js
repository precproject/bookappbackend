const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  type: { type: String, enum: ['Addition', 'Deduction', 'Creation'], required: true },
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
  price: { type: Number, required: true },
  stock: { type: Number, default: null }, // Null means infinite (Digital)
  history: [historySchema]
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);