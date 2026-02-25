const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/addresses', protect, userController.getAddresses);
router.post('/addresses', protect, userController.addAddress);

module.exports = router;