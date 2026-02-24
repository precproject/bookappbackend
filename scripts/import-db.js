const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load Models
const User = require('./models/User');
const Book = require('./models/Book');
const Order = require('./models/Order');
const Referral = require('./models/Referral');
const Discount = require('./models/Discount');
const Config = require('./models/Config');

dotenv.config();

const importDatabase = async () => {
  console.log('⚠️ WARNING: This will overwrite existing data in your database.');
  
  try {
    console.log('⏳ Connecting to MongoDB for Import...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!');

    const exportDir = path.join(__dirname, 'data-export');
    if (!fs.existsSync(exportDir)) {
      throw new Error('No data-export folder found. Run export-db.js first.');
    }

    const collections = [
      { name: 'users', model: User },
      { name: 'books', model: Book },
      { name: 'orders', model: Order },
      { name: 'referrals', model: Referral },
      { name: 'discounts', model: Discount },
      { name: 'configs', model: Config }
    ];

    console.log('📥 Importing collections from JSON...');

    for (let col of collections) {
      const filePath = path.join(exportDir, `${col.name}.json`);
      
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileData);

        if (jsonData.length > 0) {
          // 1. Clear the existing collection to prevent duplicate ID errors
          await col.model.deleteMany();
          
          // 2. Insert raw data (bypasses Mongoose hooks so passwords don't double-hash)
          await col.model.collection.insertMany(jsonData);
          console.log(`   -> Imported ${jsonData.length} records into ${col.name}`);
        } else {
          console.log(`   -> Skipped ${col.name} (JSON file is empty)`);
        }
      } else {
        console.log(`   -> Skipped ${col.name} (No JSON file found)`);
      }
    }

    console.log('\n🎉 SUCCESS! All data has been restored from the /data-export folder.');
  } catch (error) {
    console.error('❌ Import Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

importDatabase();