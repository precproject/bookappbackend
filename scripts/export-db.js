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

const exportDatabase = async () => {
  try {
    console.log('⏳ Connecting to MongoDB for Export...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!');

    // Create export directory if it doesn't exist
    const exportDir = path.join(__dirname, 'data-export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    const collections = [
      { name: 'users', model: User },
      { name: 'books', model: Book },
      { name: 'orders', model: Order },
      { name: 'referrals', model: Referral },
      { name: 'discounts', model: Discount },
      { name: 'configs', model: Config }
    ];

    console.log('📦 Exporting collections to JSON...');

    for (let col of collections) {
      const data = await col.model.find({});
      const filePath = path.join(exportDir, `${col.name}.json`);
      
      // Write to file (pretty printed)
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`   -> Exported ${data.length} records to ${col.name}.json`);
    }

    console.log('\n🎉 SUCCESS! All data exported to the /data-export folder.');
  } catch (error) {
    console.error('❌ Export Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

exportDatabase();