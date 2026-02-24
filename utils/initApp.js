const User = require('../models/User');
const Config = require('../models/Config');
const bcrypt = require('bcryptjs');

const initializeSystem = async () => {
  try {
    console.log('--- System Initialization Check ---');

    // 1. Verify Configuration Exists
    let config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    if (!config) {
      console.log('Creating default system configuration...');
      await Config.create({ singletonId: 'SYSTEM_CONFIG' });
    }

    // 2. Verify Admin Exists
    const adminExists = await User.findOne({ role: 'Admin' });
    if (!adminExists) {
      console.log('No Admin found. Creating default Super Admin...');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Admin@123', salt);

      await User.create({
        name: 'Super Admin',
        email: 'admin@chintamukti.com',
        mobile: '9999999999',
        password: "Admin@123", // Bypassing pre-save hook by hashing here manually for safety in init script
        role: 'Admin',
        status: 'Active'
      });
      console.log('Default Admin Created: admin@chintamukti.com / Admin@123');
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