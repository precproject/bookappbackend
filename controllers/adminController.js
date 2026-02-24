const Order = require('../models/Order');
const User = require('../models/User');
const Book = require('../models/Book');
const Discount = require('../models/Discount');
const Referral = require('../models/Referral');
const Config = require('../models/Config');

// --- DASHBOARD HOME ---
// @route   GET /api/admin/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({ role: 'Customer' });
    const inProgressDeliveries = await Order.countDocuments({ status: 'In Progress' });
    
    const successfulOrders = await Order.find({ status: 'Success' });
    const totalEarnings = successfulOrders.reduce((acc, order) => acc + order.priceBreakup.total, 0);

    const pendingPayments = await Order.find({ status: 'Pending Payment' })
      .populate('user', 'email')
      .select('orderId priceBreakup.total user')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentPurchasers = await Order.find({ status: 'Success' })
      .populate('user', 'name')
      .select('user createdAt status')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      stats: { totalOrders, totalUsers, inProgressDeliveries, totalEarnings },
      pendingPayments,
      recentPurchasers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- ORDERS ---
// @route   GET /api/admin/orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email mobile')
      .populate('items.book', 'title type')
      .sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, partner, trackingId } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status || order.status;
    if (partner) order.shipping.partner = partner;
    if (trackingId) order.shipping.trackingId = trackingId;

    await order.save();
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- USERS ---
// @route   GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    // Uses aggregation to get users and their total order counts/spent in one call
    const users = await User.aggregate([
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'orders'
        }
      },
      {
        $project: {
          name: 1, email: 1, mobile: 1, role: 1, status: 1, createdAt: 1,
          ordersCount: { $size: "$orders" },
          spent: { 
            $sum: {
              $map: {
                input: { $filter: { input: "$orders", as: "o", cond: { $eq: ["$$o.status", "Success"] } } },
                as: "successOrder",
                in: "$$successOrder.priceBreakup.total"
              }
            }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/users/:id/toggle-status
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'Admin') return res.status(400).json({ message: 'Cannot disable another Admin' });

    user.status = user.status === 'Active' ? 'Disabled' : 'Active';
    await user.save();
    res.status(200).json({ message: `User status changed to ${user.status}`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- INVENTORY ---
// @route   GET /api/admin/inventory
exports.getInventory = async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/admin/inventory
exports.addBook = async (req, res) => {
  try {
    const book = await Book.create({
      ...req.body,
      history: [{ type: 'Creation', reason: 'Initial Setup', change: req.body.stock, balance: req.body.stock || '∞' }]
    });
    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/inventory/:id
exports.updateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const newStock = req.body.type === 'Digital' ? null : Number(req.body.stock);
    
    // Log history if physical stock manually changed
    if (book.type === 'Physical' && newStock !== book.stock) {
      const stockDiff = newStock - book.stock;
      book.history.unshift({
        type: stockDiff > 0 ? 'Addition' : 'Deduction',
        reason: 'Manual Admin Adjustment',
        change: stockDiff,
        balance: newStock
      });
    }

    Object.assign(book, req.body);
    book.stock = newStock;
    await book.save();
    
    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- REFERRALS ---
// @route   GET /api/admin/referrals
exports.getAllReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find().populate('user', 'name').populate('transactions', 'orderId status priceBreakup.total createdAt');
    res.status(200).json(referrals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/admin/referrals
exports.createReferral = async (req, res) => {
  try {
    const referral = await Referral.create(req.body);
    res.status(201).json(referral);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/referrals/:id/mark-paid
exports.markReferralPaid = async (req, res) => {
  try {
    const { amount } = req.body;
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });

    referral.pendingPayout = Math.max(0, referral.pendingPayout - amount);
    await referral.save();
    res.status(200).json(referral);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- DISCOUNTS ---
// @route   GET /api/admin/discounts
exports.getDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.status(200).json(discounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/admin/discounts
exports.addDiscount = async (req, res) => {
  try {
    const discount = await Discount.create(req.body);
    res.status(201).json(discount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/discounts/:id
exports.updateDiscount = async (req, res) => {
  try {
    const discount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(discount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/settings
exports.getSettings = async (req, res) => {
  try {
    let config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    if (!config) config = await Config.create({ singletonId: 'SYSTEM_CONFIG' });
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/settings
exports.updateSettings = async (req, res) => {
  try {
    const { general, payment, delivery } = req.body;
    const config = await Config.findOneAndUpdate(
      { singletonId: 'SYSTEM_CONFIG' },
      { $set: { general, payment, delivery } },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Settings updated successfully', config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};