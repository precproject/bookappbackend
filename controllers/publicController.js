const Order = require('../models/Order');

// @route   GET /api/public/recent-purchases
// @desc    Get anonymized data of the last 10 successful orders
exports.getRecentPurchases = async (req, res) => {
  try {
    // Fetch last 10 successful or in-progress orders
    const recentOrders = await Order.find({ 
      status: { $in: ['Success', 'In Progress', 'Delivered'] } 
    })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    const sanitizedData = recentOrders.map(order => {
      // 1. Anonymize Name (e.g., "Rahul Patil" -> "Rahul P.")
      let safeName = "Guest";
      if (order.user && order.user.name) {
        const nameParts = order.user.name.split(' ');
        safeName = nameParts.length > 1 
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.` 
          : nameParts[0];
      }

      // 2. Extract City from Address (Format: Name, Phone, Street, City, State - PIN)
      let safeLocation = "India";
      if (order.shipping && order.shipping.address === 'Digital Delivery') {
        safeLocation = "Online";
      } else if (order.shipping && order.shipping.address) {
        const addressParts = order.shipping.address.split(',');
        if (addressParts.length >= 4) {
          safeLocation = addressParts[3].trim(); // City is usually the 4th item
        }
      }

      return {
        name: safeName,
        location: safeLocation,
        timestamp: order.createdAt
      };
    });

    res.status(200).json(sanitizedData);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recent purchases' });
  }
};