const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  // Use a fixed ID so we always update the same single document
  singletonId: { type: String, default: 'SYSTEM_CONFIG', unique: true },
  general: {
    storeName: { type: String, default: 'Chintamukti' },
    supportEmail: { type: String, default: 'support@chintamukti.com' },
    supportPhone: { type: String, default: '+91 0000000000' }
  },
  payment: {
    provider: { type: String, default: 'PhonePe' },
    merchantId: { type: String, default: '' },
    saltKey: { type: String, default: '' },
    saltIndex: { type: Number, default: 1 },
    isLiveMode: { type: Boolean, default: false }
  },
  delivery: {
    provider: { type: String, default: 'Delhivery' },
    apiToken: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);