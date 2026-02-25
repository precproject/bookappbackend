const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // e.g., 'BK-8021'
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  priceBreakup: {
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    discountCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 }, // NEW FIELD
    referralApplied: { type: String, default: null },
    total: { type: Number, required: true }
  },
  payment: {
    txnId: { type: String },
    method: { type: String }, // 'PhonePe', 'Razorpay', etc.
    status: { type: String, enum: ['Pending', 'Success', 'Failed'], default: 'Pending' },
    initiatedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
  },
  shipping: {
    address: { type: String, required: true },
    partner: { type: String, default: 'Pending Assign' },
    trackingId: { type: String, default: '-' }
  },
  transitHistory: [{
    stage: { type: String }, // e.g., 'Order Placed', 'Shipped', 'Delivered'
    time: { type: Date },
    completed: { type: Boolean, default: false }
  }],
  status: { 
    type: String, 
    enum: ['Pending Payment', 'In Progress', 'Delivered', 'Cancelled', 'Success', 'Failed'],
    default: 'Pending Payment' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);