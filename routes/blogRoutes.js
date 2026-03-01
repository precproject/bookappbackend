const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getBlogBySlug, getBlogs } = require('../controllers/blogController');

router.get('/', getBlogs);
router.get('/:slug', getBlogBySlug);

module.exports = router;