const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { protect, admin } = require('../middlewares/authMiddleware'); // Uncomment to secure this!

// Add 'protect' and 'admin' middleware if only admins should upload images
router.post('/', protect, admin, uploadController.upload.single('image'), uploadController.processAndSaveImage);

module.exports = router;