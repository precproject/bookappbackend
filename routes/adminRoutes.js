const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
const {
  getDashboardStats,
  getAllOrders, updateOrderStatus,
  getAllUsers, toggleUserStatus,
  getInventory, addBook, updateBook,
  getAllReferrals, createReferral, markReferralPaid,
  getDiscounts, addDiscount, updateDiscount
} = require('../controllers/adminController');

const { getSettings, updateSettings } = require('../controllers/adminController');

// All routes require login AND admin privileges
router.use(protect, admin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Orders
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);

// Inventory
router.get('/inventory', getInventory);
router.post('/inventory', addBook);
router.put('/inventory/:id', updateBook);

// Referrals
router.get('/referrals', getAllReferrals);
router.post('/referrals', createReferral);
router.put('/referrals/:id/mark-paid', markReferralPaid);

// Discounts
router.get('/discounts', getDiscounts);
router.post('/discounts', addDiscount);
router.put('/discounts/:id', updateDiscount);

// Add under existing routes
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;