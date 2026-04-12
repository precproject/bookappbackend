const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Discount = require('../models/Discount');
const Referral = require('../models/Referral');
const { getRecentPurchases, getAllBooks, getBookByIdOrSku, getBookReviews, addBookReview, deleteReview, verifyReferralCode } = require('../controllers/publicController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/recent-purchases', getRecentPurchases);
// Book Catalog
// router.get('/books', getAllBooks); <= Declared twice or unused or combine with 

// Single Book Details (Accepts :id as MongoDB ID or SKU String)
router.get('/books/:id', getBookByIdOrSku);

// Book Reviews
router.get('/books/:id/reviews', getBookReviews);
router.post('/books/:id/reviews', protect, addBookReview);
router.delete('/books/:id/reviews/:reviewId', protect, deleteReview);

// @route   GET /api/public/books
// @desc    Fetch available books for the storefront
router.get('/books', async (req, res) => {
  try {
    // Only fetch books that have stock or are digital
    const books = await Book.find({
      $or: [{ stock: { $gt: 0 } }, { type: 'Digital' }]
    }).select('-history'); // Hide history from public
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Referrals
router.get('/referrals/verify/:code', verifyReferralCode);

module.exports = router;

