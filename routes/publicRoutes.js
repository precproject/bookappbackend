const express = require('express');
const router = express.Router();
const Book = require('../models/Book');

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

module.exports = router;