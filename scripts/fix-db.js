const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const fixDatabase = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!');

    console.log('⏳ Dropping the broken referralCode index...');
    // This removes the stubborn index directly from the database
    await mongoose.connection.collection('users').dropIndex('referralCode_1');
    
    console.log('🎉 SUCCESS! The broken index is gone.');
  } catch (error) {
    if (error.codeName === 'IndexNotFound') {
      console.log('✅ The index is already gone! You are good to go.');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    process.exit(0);
  }
};

fixDatabase();