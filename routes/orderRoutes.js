const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, retryPayment } = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

// Customer routes (must be logged in)
router.post('/checkout', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/verify-payment/:orderId', protect, require('../controllers/orderController').verifyPaymentStatus);
router.get('/retry-payment/:orderId', protect, retryPayment);

module.exports = router;