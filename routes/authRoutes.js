const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, instantLogin } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/instant-login', instantLogin);

module.exports = router;