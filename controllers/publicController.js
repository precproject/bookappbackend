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
    // Optionally filter by { status: 'Active' } if you have a status field
    const books = await Book.find().sort({ createdAt: -1 });
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
    const book = await Book.findOne(query);

    if (!book) return res.status(404).json({ message: 'Book not found' });

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

    const reviews = await Review.find({ book: book._id, status: 'Active' })
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

    // 2. Check if user already reviewed this book
    const existingReview = await Review.findOne({ book: book._id, user: userId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this book.' });
    }

    // 3. Create the review
    const review = await Review.create({
      book: book._id,
      user: userId,
      rating: Number(rating),
      comment
    });

    // 4. Update the book's average rating 
    const allReviews = await Review.find({ book: book._id, status: 'Active' });
    const avgRating = allReviews.reduce((acc, item) => item.rating + acc, 0) / allReviews.length;
    
    book.rating = parseFloat(avgRating.toFixed(1)); // Save as e.g., 4.5
    await book.save();

    // 5. Populate user data before sending back to frontend so it displays immediately
    await review.populate('user', 'name');

    res.status(201).json(review);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this book.' });
    }
    res.status(500).json({ message: 'Failed to submit review', error: error.message });
  }
};