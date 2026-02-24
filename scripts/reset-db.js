const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const resetDatabase = async () => {
  console.log('⚠️  WARNING: INITIATING FULL DATABASE WIPE...');
  
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in .env file!');
    }

    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to Database!');

    console.log('⏳ Dropping the entire database...');
    // This wipes everything: Collections, Documents, and Indexes
    await mongoose.connection.db.dropDatabase();
    
    console.log('🎉 SUCCESS! The database is completely clean and empty.');
    
  } catch (error) {
    console.error('❌ Error during database wipe:', error.message);
  } finally {
    // Close the connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB. You can now restart your server.');
    process.exit(0);
  }
};

resetDatabase();