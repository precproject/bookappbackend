const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Discount = require('../models/Discount');
const Referral = require('../models/Referral');
const { getRecentPurchases, getAllBooks, getBookByIdOrSku, getBookReviews, addBookReview } = require('../controllers/publicController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/recent-purchases', getRecentPurchases);
// Book Catalog
router.get('/books', getAllBooks);

// Single Book Details (Accepts :id as MongoDB ID or SKU String)
router.get('/books/:id', getBookByIdOrSku);

// Book Reviews
router.get('/books/:id/reviews', getBookReviews);
router.post('/books/:id/reviews', protect, addBookReview);

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

// @route   POST /api/public/validate-promo
router.post('/validate-promo', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const discount = await Discount.findOne({ code: code.toUpperCase(), status: 'Active' });
    
    if (!discount) return res.status(404).json({ message: 'Invalid promo code' });
    if (discount.validTill && new Date(discount.validTill) < new Date()) return res.status(400).json({ message: 'Code expired' });
    if (discount.maxUsage && discount.currentUsage >= discount.maxUsage) return res.status(400).json({ message: 'Usage limit reached' });

    let discountAmount = discount.type === 'Percentage' 
      ? Math.min((subtotal * discount.value) / 100, discount.maxDiscount)
      : discount.value;

    res.status(200).json({ valid: true, discountAmount });
  } catch (error) {
    res.status(500).json({ message: 'Error validating code' });
  }
});


// @route   GET /api/public/
// @desc    Check if a referral code is valid and get the referrer's name
router.get('/referrals/verify/:code',  async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const referral = await Referral.findOne({ code, status: 'Active' }).populate('user', 'name');
    
    if (!referral) {
      return res.status(404).json({ valid: false, message: 'Invalid or expired code' });
    }

    res.status(200).json({ 
      valid: true, 
      referrerName: referral.user.name.split(' ')[0] // Just send the first name for privacy
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during verification' });
  }
});

module.exports = router;