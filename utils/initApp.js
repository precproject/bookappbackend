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
        mode: 'UAT', // 'UAT' (test) or 'PROD' (production)
        merchantId: 'PGTESTPAYUAT',
        saltKey: '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399', // Replace with production keys later
        saltIndex: '1'
      },

      // Delivery/Shipping Gateway (Delhivery)
      deliveryApi: {
        provider: 'Delhivery',
        mode: 'TEST', // 'TEST' or 'PROD'
        apiToken: 'YOUR_DELHIVERY_TEST_TOKEN', 
        pickupPincode: '422001' // E.g., Nashik pincode
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
        supportEmail: 'hello@sahakarstree.in',
        supportPhone: '+919876543210',
        businessAddress: 'Nashik, Maharashtra, India'
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
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Admin@123', salt);

      await User.create({
        name: 'Super Admin',
        email: 'admin@sahakarstree.com',
        mobile: '9999999999',
        password: hashedPassword, // Fixed: Use the hashed password here
        role: 'Admin',
        status: 'Active'
      });
      console.log('Default Admin Created: admin@sahakarstree.com / Admin@123');
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