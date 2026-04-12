const fs = require('fs').promises;
const path = require('path');
const User = require('../../models/User');
const Book = require('../../models/Book');
const Order = require('../../models/Order');
const Referral = require('../../models/Referral');
const Discount = require('../../models/Discount');
const Config = require('../../models/Config');
const Review = require('../../models/Review');
const Blog = require('../../models/Blog');

const importDatabase = async () => {
  try {
    const exportDir = path.join(__dirname, '../data-export');
    
    const collections = [
      { name: 'users', model: User },
      { name: 'books', model: Book },
      { name: 'orders', model: Order },
      { name: 'referrals', model: Referral },
      { name: 'discounts', model: Discount },
      { name: 'configs', model: Config },
      { name: 'reviews', model: Review },
      { name: 'blogs', model: Blog }
    ];

    for (let col of collections) {
      const filePath = path.join(exportDir, `${col.name}.json`);
      
      try {
        const fileData = await fs.readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(fileData);

        if (jsonData.length > 0) {
          await col.model.deleteMany();
          await col.model.collection.insertMany(jsonData);
          console.log(`[DB IMPORT] Imported ${jsonData.length} records into ${col.name}`);
        }
      } catch (err) {
        console.log(`[DB IMPORT] Skipped ${col.name} (File not found or empty)`);
      }
    }
    console.log('[DB IMPORT] Restore completed successfully.');
  } catch (error) {
    console.error('[DB IMPORT] Error:', error.message);
    throw error;
  }
};

module.exports = { importDatabase };