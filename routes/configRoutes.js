const express = require('express');
const router = express.Router();
const { 
  getConfig, 
  updateConfig, 
  getPublicConfig 
} = require('../controllers/configController');

// Import your auth middleware (adjust paths if needed)
const { protect, admin } = require('../middlewares/authMiddleware');

// ----------------------------------------------------
// PUBLIC ROUTE (Safe for frontend)
// GET /api/config/public
// ----------------------------------------------------
router.get('/public', getPublicConfig);

// ----------------------------------------------------
// ADMIN ROUTES (Highly secured)
// GET /api/config
// PUT /api/config
// ----------------------------------------------------
router.route('/')
  .get(protect, admin, getConfig)
  .put(protect, admin, updateConfig);

module.exports = router;