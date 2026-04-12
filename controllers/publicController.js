const Order = require('../models/Order');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Review = require('../models/Review');

// @route   GET /api/public/recent-purchases
// @desc    Get anonymized data of the last 10 successful orders
exports.getRecentPurchases = async (req, res) => {
  try {
    // Fetch last 10 successful or in-progress orders
    const recentOrders = await Order.find({ 
      status: { $in: ['Success', 'In Progress', 'Delivered'] } 
    })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    const sanitizedData = recentOrders.map(order => {
      // 1. Anonymize Name (e.g., "Rahul Patil" -> "Rahul P.")
      let safeName = "Guest";
      if (order.user && order.user.name) {
        const nameParts = order.user.name.split(' ');
        safeName = nameParts.length > 1 
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.` 
          : nameParts[0];
      }

      // 2. Extract City from Address (Format: Name, Phone, Street, City, State - PIN)
      let safeLocation = "India";
      if (order.shipping && order.shipping.address === 'Digital Delivery') {
        safeLocation = "Online";
      } else if (order.shipping && order.shipping.address) {
        const addressParts = order.shipping.address.split(',');
        if (addressParts.length >= 4) {
          safeLocation = addressParts[3].trim(); // City is usually the 4th item
        }
      }

      return {
        name: safeName,
        location: safeLocation,
        timestamp: order.createdAt
      };
    });

    res.status(200).json(sanitizedData);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recent purchases' });
  }
};

// Helper to handle flexible ID or SKU queries
const buildBookQuery = (identifier) => {
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return { $or: [{ _id: identifier }, { sku: identifier }] };
  }
  return { sku: identifier };
};

// @route   GET /api/public/books
// @desc    Get all active books for the store
exports.getAllBooks = async (req, res) => {
  try {
    // 1. Only fetch books marked as 'Active'
    // 2. Hide the private admin 'history' array and mongo '__v' version key
    const books = await Book.find({ status: 'Active' })
      .select('-history -__v')
      .sort({ createdAt: -1 });
      
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch books', error: error.message });
  }
};

// @route   GET /api/public/books/:id
// @desc    Get a single book by MongoDB _id OR Custom SKU
exports.getBookByIdOrSku = async (req, res) => {
  try {
    const query = buildBookQuery(req.params.id);
    
    // Ensure we hide the private history here as well!
    const book = await Book.findOne(query).select('-history -__v');

    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    // Optional Safety: If an admin hides a book, stop public users from viewing its direct link
    if (book.status === 'Inactive') {
      return res.status(404).json({ message: 'This book is currently unavailable' });
    }

    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch book', error: error.message });
  }
};

// @route   GET /api/public/books/:id/reviews
// @desc    Get all active reviews for a specific book (by ID or SKU)
exports.getBookReviews = async (req, res) => {
  try {
    const query = buildBookQuery(req.params.id);
    const book = await Book.findOne(query).select('_id');
    
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const reviews = await Review.find({ book: book._id, status: 'Approved' })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
};

// @route   POST /api/public/books/:id/reviews
// @desc    Add a review to a book (Requires Auth)
exports.addBookReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // 1. Find the book (by ID or SKU)
    const query = buildBookQuery(req.params.id);
    const book = await Book.findOne(query);
    
    if (!book) return res.status(404).json({ message: 'Book not found' });

    // 2. NEW: VERIFIED PURCHASE CHECK
    // Look for any successful order by this user that contains this specific book
    const hasPurchased = await Order.findOne({
      user: userId,
      'items.book': book._id,
      'payment.status': 'Success' // Ensure they actually paid for it
    });

    if (!hasPurchased) {
      return res.status(403).json({ 
        message: 'You can only review books that you have purchased.' 
      });
    }

    // 3. Check if user already reviewed this book
    const existingReview = await Review.findOne({ book: book._id, user: userId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this book.' });
    }

    // 4. Create the review
    const review = await Review.create({
      book: book._id,
      user: userId,
      rating: Number(rating),
      comment
    });

    // 5. Update the book's average rating 
    const allReviews = await Review.find({ book: book._id, status: 'Approved' });
    const avgRating = allReviews.reduce((acc, item) => item.rating + acc, 0) / allReviews.length;
    
    book.rating = parseFloat(avgRating.toFixed(1)); // Save as e.g., 4.5
    await book.save();

    // 6. Populate user data before sending back to frontend so it displays immediately
    await review.populate('user', 'name');

    res.status(201).json(review);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this book.' });
    }
    res.status(500).json({ message: 'Failed to submit review', error: error.message });
  }
};

// @route   DELETE /api/public/books/:id/reviews/:reviewId
// @desc    Delete a review
exports.deleteReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    
    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // SECURITY CHECK: Ensure the person deleting is either the author OR an Admin
    if (review.user.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(401).json({ message: 'Not authorized to delete this review' });
    }

    // Delete it from the database
    await review.deleteOne();
    
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting review' });
  }
};

// @route   GET /api/public/
// @desc    Check if a referral code is valid and get the referrer's name
exports.verifyReferralCode =  async (req, res) => {
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
};