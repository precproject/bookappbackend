const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  // Use a fixed ID so we always update the same single document
  singletonId: { type: String, default: 'SYSTEM_CONFIG', unique: true },
  
  // 1. General Info & Contact (Expanded)
  general: {
    storeName: { type: String, default: 'SahakarStree' },
    supportEmail: { type: String, default: 'sahakarstree@gmail.com' },
    supportPhone: { type: String, default: '+91 0000000000' },
    businessAddress: { type: String, default: '' } // Added for footer
  },

  // 2. Landing Page Section Visibility (Hide/Show)
  sections: {
    hero: { type: Boolean, default: true },
    features: { type: Boolean, default: true },
    chapters: { type: Boolean, default: true },
    author: { type: Boolean, default: true },
    reviews: { type: Boolean, default: true },
    blog: { type: Boolean, default: true },
    footer: { type: Boolean, default: true }
  },

  // 3. E-commerce & Shopping Rules
  shoppingRules: {
    referralBasedShoppingOnly: { type: Boolean, default: true }, // Default true per your request
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' }
  },

  // 4. Tax Configuration
  taxConfig: {
    isGstEnabled: { type: Boolean, default: true },
    gstPercentage: { type: Number, default: 0 },
    hsnCode: { type: String, default: '4901' } // Standard HSN for printed books
  },

  // 5. Payment API (Original + expanded)
  payment: {
    provider: { type: String, default: 'PhonePe' },
    merchantId: { type: String, default: '' },
    saltKey: { type: String, default: '' },
    saltIndex: { type: Number, default: 1 },
    isLiveMode: { type: Boolean, default: false } // False = UAT, True = PROD
  },

  // 6. Delivery API (Original + expanded)
  delivery: {
    provider: { type: String, default: 'Delhivery' },
    apiToken: { type: String, default: '' },
    pickupPincode: { type: String, default: '' }, // Needed to fetch shipping rates
    isLiveMode: { type: Boolean, default: false },
    shippingCharge: { type: Number, default: 50 } // <--- ADD THIS LINE
  },

  // 7. Social Media Links
  socialLinks: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    youtube: { type: String, default: '' }
  },
  security: {
    adminMasterSecret: { type: String, default: 'SahakarStree@123' } // Default fallback code
  },

  // 7. Email Notifications Toggle
  emailAlerts: {
    welcome: { type: Boolean, default: true },
    orderPlaced: { type: Boolean, default: true },
    paymentSuccess: { type: Boolean, default: true },
    orderDispatched: { type: Boolean, default: true },
    orderDelivered: { type: Boolean, default: true },
    paymentReminder: { type: Boolean, default: true }
  },

  // 8. Homescreen / UI Settings
  uiConfig: {
    showRecentOrdersPopup: { type: Boolean, default: true }
  }

}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);