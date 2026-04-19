const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // e.g., 'BK-8021'
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  items: [{
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['Physical', 'Digital'] }, // <--- ADDED: Crucial for the User Dashboard UI
    qty: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  
  priceBreakup: {
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    discountCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    referralApplied: { type: String, default: null },
    total: { type: Number, required: true }
  },
  
  payment: {
    txnId: { type: String },
    method: { type: String }, // 'PhonePe', 'Razorpay', etc.
    status: { type: String, enum: ['Pending', 'Success', 'Failed','Refunded'], default: 'Pending' },
    initiatedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    retryCount: { type: Number, default: 0 }, // <-- Add this
  },
  
  shipping: {
    // ---> REMOVED required: true. Validated in orderController instead! <---
    fullName: { type: String },
    phone: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    
    partner: { type: String, default: 'Pending Assign' },
    trackingId: { type: String, default: null },
    awbStatus: { type: String, default: null }, // e.g., 'Manifested', 'In Transit'
    estimatedDelivery: { type: Date, default: null }, // TAT stored here
    isDispatchedAlertSent: { type: Boolean, default: false }
  },
  
  transitHistory: [{
    stage: { type: String }, // e.g., 'Order Placed', 'Shipped', 'Delivered'
    time: { type: Date, default: Date.now }, // Added default Date.now for safety
    completed: { type: Boolean, default: false }
  }],
  
  status: { 
    type: String, 
    enum: ['Pending Payment', 'In Progress', 'Delivered', 'Cancelled', 'Success', 'Failed'],
    default: 'Pending Payment' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);