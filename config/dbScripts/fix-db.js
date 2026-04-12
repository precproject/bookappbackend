const mongoose = require('mongoose');

const fixDatabase = async () => {
  try {
    console.log('[DB FIX] Dropping referralCode_1 index...');
    await mongoose.connection.collection('users').dropIndex('referralCode_1');
    console.log('[DB FIX] Index dropped successfully.');
    return { status: 'success', message: 'Index dropped' };
  } catch (error) {
    if (error.codeName === 'IndexNotFound') {
      console.log('[DB FIX] Index already gone.');
      return { status: 'skipped', message: 'Index already gone' };
    }
    console.error('[DB FIX] Error:', error.message);
    throw error;
  }
};

module.exports = { fixDatabase };