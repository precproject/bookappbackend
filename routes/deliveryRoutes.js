const express = require('express');
const router = express.Router();
const delhiveryService = require('../services/delhiveryService');
const Order = require('../models/Order');
const { protect } = require('../middleware/authMiddleware'); // Your auth middleware

// 1. Check Serviceability & Fetch Rate (Called on Frontend Checkout Page)
router.post('/check-rate', async (req, res) => {
  try {
    const { pincode } = req.body;
    if (!pincode) return res.status(400).json({ message: 'Pincode is required' });

    const serviceCheck = await delhiveryService.checkServiceability(pincode);
    
    if (!serviceCheck.isServiceable) {
      return res.status(400).json({ 
        serviceable: false, 
        message: 'Sorry, we do not deliver to this pincode currently.' 
      });
    }

    // If serviceable, fetch the dynamic rate
    const rateCheck = await delhiveryService.calculateShipping(pincode);
    
    res.status(200).json({
      serviceable: true,
      city: serviceCheck.city,
      state: serviceCheck.state,
      shippingCharge: rateCheck.success ? rateCheck.charge : 50 // Fallback to 50 if calc fails
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking delivery details.' });
  }
});

// 2. Fetch Tracking Info for a User's Order
router.get('/track/:orderId', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, user: req.user._id });
    
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.tracking || !order.tracking.awbNumber) {
      return res.status(400).json({ message: 'Tracking has not been generated yet.' });
    }

    // Fetch live tracking from Delhivery
    const trackingData = await delhiveryService.trackShipment(order.tracking.awbNumber);
    
    if (trackingData.success) {
      // Update our database with the latest status
      order.tracking.currentStatus = trackingData.status;
      order.tracking.lastUpdated = new Date();
      await order.save();

      res.status(200).json({ tracking: trackingData });
    } else {
      res.status(400).json({ message: 'Could not fetch tracking details from courier.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tracking.' });
  }
});

module.exports = router;