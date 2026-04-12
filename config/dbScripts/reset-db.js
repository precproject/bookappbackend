const mongoose = require('mongoose');

const resetDatabase = async () => {
  try {
    console.log('[DB RESET] Dropping the entire database...');
    await mongoose.connection.db.dropDatabase();
    console.log('[DB RESET] Database wiped clean.');
  } catch (error) {
    console.error('[DB RESET] Error:', error.message);
    throw error;
  }
};

module.exports = { resetDatabase };