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

const exportDatabase = async () => {
  try {
    const exportDir = path.join(__dirname, '../data-export');
    
    // Ensure directory exists
    try {
      await fs.access(exportDir);
    } catch {
      await fs.mkdir(exportDir, { recursive: true });
    }

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
      const data = await col.model.find({}).lean();
      const filePath = path.join(exportDir, `${col.name}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      console.log(`[DB EXPORT] Exported ${data.length} records to ${col.name}.json`);
    }
    console.log('[DB EXPORT] Full backup completed successfully.');
  } catch (error) {
    console.error('[DB EXPORT] Error:', error.message);
    throw error; // Throw error so the controller can catch it if needed
  }
};

module.exports = { exportDatabase };