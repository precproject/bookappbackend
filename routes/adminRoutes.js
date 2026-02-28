const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
const {
  getDashboardStats,
  getAllOrders, updateOrderStatus,
  getAllUsers, toggleUserStatus,
  getInventory, addBook, updateBook,
  getAllReferrals, createReferral, markReferralPaid,
  getDiscounts, addDiscount, updateDiscount,
  updateOrderTransit,
  deleteBook,
  markTransactionPaid,
  getReferralTransactions,
  updateReferral,
  createUser
} = require('../controllers/adminController');

const { getSettings, updateSettings } = require('../controllers/adminController');

// All routes require login AND admin privileges
router.use(protect, admin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Orders
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/transit', updateOrderTransit); // Used by Delivery

// Users
router.post('/users', createUser);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);

// Inventory
router.get('/inventory', getInventory);
router.post('/inventory', addBook);
router.put('/inventory/:id', updateBook);
router.delete('/inventory/:id', deleteBook);

// Referrals
router.get('/referrals', getAllReferrals);
router.post('/referrals', createReferral);
router.put('/referrals/:id', updateReferral);
router.get('/referrals/:id/transactions', getReferralTransactions);
router.put('/referrals/transactions/:transactionId/pay', markTransactionPaid);

// Discounts
router.get('/discounts', getDiscounts);
router.post('/discounts', addDiscount);
router.put('/discounts/:id', updateDiscount);

// Add under existing routes
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/config', getSettings);
router.put('/config/:section', updateSettings); // <-- Matches frontend updateConfig('general', data)

module.exports = router;