const User = require('../models/User');
const Config = require('../models/Config');
const bcrypt = require('bcryptjs');

const initializeSystem = async () => {
  try {
    console.log('--- System Initialization Check ---');

    // 1. Define Default Configuration
    const defaultConfig = {
      singletonId: 'SYSTEM_CONFIG',
      
      // Feature Flags / Section Visibility (Default: true)
      sections: {
        hero: true,
        features: true,
        chapters: true,
        author: true,
        reviews: true,
        blog: true,
        footer: true
      },

      // E-commerce Rules
      shoppingRules: {
        referralBasedShoppingOnly: true, // If true, requires referral code to buy
        currency: 'INR',
        currencySymbol: '₹'
      },

      // Tax Configuration
      taxConfig: {
        isGstEnabled: true,
        gstPercentage: 0, // e.g., 5, 12, 18. Set to 0 if inclusive or exempt
        hsnCode: '4901' // Standard HSN code for printed books
      },

      // Payment Gateway (PhonePe)
      paymentApi: {
        provider: 'PhonePe',
        mode: process.env.PHONEPE_ENV || 'UAT',
        merchantId: process.env.PHONEPE_MERCHANT_ID || '',
        saltKey: process.env.PHONEPE_SALT_KEY || '',
        saltIndex: '1'
      },

      // Delivery/Shipping Gateway (Delhivery)
      deliveryApi: {
        provider: 'Delhivery',
        mode: process.env.DELHIVERY_ENV || 'TEST',
        apiToken: process.env.DELHIVERY_API_KEY || '',
        pickupPincode: '422001'
      },

      // Social Media Links
      socialLinks: {
        facebook: 'https://facebook.com',
        twitter: 'https://twitter.com',
        instagram: 'https://instagram.com',
        linkedin: 'https://linkedin.com',
        youtube: 'https://youtube.com'
      },

      // Global Contact Info (For Footer / Contact Pages)
      contactInfo: {
        supportEmail: process.env.SUPPORT_EMAIL || 'hello@sahakarstree.in',
        supportPhone:  process.env.SUPPORT_PHONE || '+91-',
        businessAddress: process.env.SUPPORT_ADDRESS || 'Maharashtra, India'
      }
    };

    // 2. Verify Configuration Exists (Create if missing)
    let config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    if (!config) {
      console.log('Creating default system configuration...');
      await Config.create(defaultConfig);
    } else {
      // Optional: You can add logic here to merge new keys into existing config if you update the schema later
      console.log('System verified: Configuration exists.');
    }

    // 3. Verify Admin Exists
    const adminExists = await User.findOne({ role: 'Admin' });
    if (!adminExists) {
      console.log('No Admin found. Creating default Super Admin...');
      
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@sahakarstree.com';
      const adminPass = process.env.ADMIN_PASS || 'Admin@123';

      // const salt = await bcrypt.genSalt(10);
      // const hashedPassword = await bcrypt.hash('Admin@123', salt);

      await User.create({
        name: 'Super Admin',
        email: adminEmail,
        mobile: '9999999999',
        password: adminPass, // Fixed: Use the hashed password here
        role: 'Admin',
        status: 'Active'
      });
      console.log('Default Admin Created: ${adminEmail}');
      console.log('PLEASE CHANGE THIS PASSWORD IMMEDIATELY AFTER LOGIN.');
    } else {
      console.log('System verified: Admin user exists.');
    }

    console.log('--- Initialization Complete ---');
  } catch (error) {
    console.error('System Initialization Failed:', error);
  }
};

module.exports = initializeSystem;