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
    const totalEarnings = successfulOrders.reduce((acc, order) => acc + (order.priceBreakup?.total || 0), 0);

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
    // FIX 1: Extract userId from req.query
    const { page = 1, limit = 10, search = '', status, paymentStatus, isDeliveryView, userId } = req.query;
    let query = {};

    // FIX 2: If userId is provided in the URL, filter orders by this specific user
    if (userId) {
      query.user = userId;
    }

    // 1. Handle Status Filters
    if (status) query.status = status;
    if (paymentStatus) query['payment.status'] = paymentStatus;
    
    // Deliveries dashboard only wants shipped/delivered items
    if (isDeliveryView === 'true') {
      query.status = { $in: ['In Progress', 'Delivered'] };
    }

    // 2. Handle Search (Order ID or finding User by name/email)
    if (search) {
      // First, find users matching the search query
      const User = require('../models/User'); // Ensure User model is accessible
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = matchingUsers.map(u => u._id);

      // Then find orders that match the orderId OR belong to those users
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { user: { $in: userIds } },
        { 'payment.transactionId': { $regex: search, $options: 'i' } }, // Search by Txn ID for payments page
        { 'shipping.trackingId': { $regex: search, $options: 'i' } }    // Search by Tracking ID for deliveries
      ];
    }

    // 3. Pagination Math
    const skip = (Number(page) - 1) * Number(limit);
    const totalItems = await Order.countDocuments(query);

    // 4. Execute Query
    const orders = await Order.find(query)
      .populate('user', 'name email mobile')
      .populate('items.book', 'title type')
      .sort({ createdAt: -1 }) // FIX 3: Removed the duplicate sort
      .skip(skip)
      .limit(Number(limit));

    // Return exact format frontend expects
    res.status(200).json({
      orders,
      totalItems,
      totalPages: Math.ceil(totalItems / Number(limit))
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;

    await order.save();
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/admin/orders/:id/transit
exports.updateOrderTransit = async (req, res) => {
  try {
    const { partner, trackingId, stage } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (partner) order.shipping.partner = partner;
    if (trackingId) order.shipping.trackingId = trackingId;
    
    // Add to transit history
    if (stage) {
      order.transitHistory.push({ stage, timestamp: new Date() });
    }

    await order.save();
    res.status(200).json({ message: 'Transit updated', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// --- USERS ---
// @route   GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    
    const { page = 1, limit = 10, search = '' } = req.query;
    
    // 1. Match Stage (Search Filter)
    let matchStage = {};
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const totalItems = await User.countDocuments(matchStage);

    // 2. Aggregation Pipeline
    // Uses aggregation to get users and their total order counts/spent in one call
    const users = await User.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
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
          name: 1, email: 1, mobile: 1, role: 1, status: 1, createdAt: 1, referralCode: 1,
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
      }
    ]);
    

    // Return properly formatted object for the frontend
    res.status(200).json({
      users,
      totalItems,
      totalPages: Math.ceil(totalItems / Number(limit))
    });

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
    const { search = '' } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }
    // Frontend expects just an array for inventory
    const books = await Book.find(query).sort({ createdAt: -1 });

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

// @route   DELETE /api/admin/inventory/:id
exports.deleteBook = async (req, res) => {
  try {
    await Book.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Inventory item removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  

// --- REFERRALS ---

// @route   GET /api/admin/referrals
exports.getAllReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    // 1. Handle Search
    let query = {};
    if (search) {
      query.code = { $regex: search, $options: 'i' };
    }

    // 2. Pagination Math
    const skip = (Number(page) - 1) * Number(limit);
    const totalItems = await Referral.countDocuments(query);
    
    // 3. Fetch from DB & Populate the User details
    const rawReferrals = await Referral.find(query)
      .populate('user', 'name email') // Correctly populates the user ref
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // 4. Map DB fields to match what the Frontend React component expects exactly
    const referrals = rawReferrals.map(ref => ({
      _id: ref._id,
      code: ref.code,
      userId: ref.user ? ref.user._id : 'N/A',
      userName: ref.user ? ref.user.name : 'Unknown User',
      rate: ref.rewardRate,        // DB uses rewardRate, Frontend uses rate
      uses: ref.uses,
      earned: ref.totalEarned,     // DB uses totalEarned, Frontend uses earned
      pending: ref.pendingPayout,  // DB uses pendingPayout, Frontend uses pending
      status: ref.status,
      isDiscountLinked: ref.isDiscountLinked
    }));

    // 5. Calculate Global Header Stats
    const allRefs = await Referral.find();
    let totalEarned = 0;
    let totalPending = 0;
    allRefs.forEach(r => {
      totalEarned += (r.totalEarned || 0);
      totalPending += (r.pendingPayout || 0);
    });

    res.status(200).json({
      referrals,
      stats: { totalEarned, totalPending },
      totalItems,
      totalPages: Math.ceil(totalItems / Number(limit))
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/admin/referrals
exports.createReferral = async (req, res) => {
  try {
    const { code, userId, rate, isDiscountLinked, status } = req.body;

    // Create the referral using the backend schema mappings
    const referral = await Referral.create({
      code: code.toUpperCase(),
      user: userId,               // Frontend sends userId, backend needs user
      rewardRate: rate,           // Frontend sends rate, backend needs rewardRate
      isDiscountLinked,
      status
    });

    // Optionally: Update the User document so the user knows their code
    await User.findByIdAndUpdate(userId, { referralCode: code.toUpperCase() });

    res.status(201).json(referral);
  } catch (error) {
    // Check for duplicate code error
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This referral code already exists.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/referrals/:id
exports.updateReferral = async (req, res) => {
  try {
    const { code, rate, isDiscountLinked, status } = req.body;

    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { 
        code: code.toUpperCase(), 
        rewardRate: rate, 
        isDiscountLinked, 
        status 
      },
      { new: true }
    );

    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    res.status(200).json(referral);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/referrals/:id/transactions
exports.getReferralTransactions = async (req, res) => {
  try {
    // Populate the nested Order document inside the transactions array
    const referral = await Referral.findById(req.params.id)
      .populate('transactions.order', 'orderId status priceBreakup createdAt');

    if (!referral) return res.status(404).json({ message: 'Referral not found' });

    // Format the transactions for the frontend modal
    const formattedTxns = referral.transactions.map(txn => ({
      _id: txn._id, // The specific transaction sub-document ID
      orderId: txn.order ? txn.order.orderId : 'Deleted Order',
      orderStatus: txn.order ? txn.order.status : 'Unknown',
      payoutStatus: txn.payoutStatus,
      amount: txn.earnedAmount,
      date: txn.date
    }));

    // Sort newest transactions first
    formattedTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json(formattedTxns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/referrals/transactions/:transactionId/pay
exports.markTransactionPaid = async (req, res) => {
  try {
    // 1. Find the referral that contains this specific transaction ID
    const referral = await Referral.findOne({ "transactions._id": req.params.transactionId });
    if (!referral) return res.status(404).json({ message: 'Transaction not found' });

    // 2. Extract that specific transaction from the array
    const txn = referral.transactions.id(req.params.transactionId);
    
    if (txn.payoutStatus === 'Paid') {
      return res.status(400).json({ message: 'Transaction is already paid' });
    }

    // 3. Mark it as Paid and deduct the amount from the global Pending Payout
    txn.payoutStatus = 'Paid';
    referral.pendingPayout = Math.max(0, referral.pendingPayout - txn.earnedAmount);
    
    await referral.save();

    res.status(200).json({ 
      message: 'Transaction marked as paid', 
      pendingPayout: referral.pendingPayout 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- DISCOUNTS ---
// @route   GET /api/admin/discounts
exports.getDiscounts = async (req, res) => {
  try {
    const { search = '' } = req.query;
    let query = {};
    if (search) {
      query.code = { $regex: search, $options: 'i' };
    }
    const discounts = await Discount.find(query).sort({ createdAt: -1 });

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
// @desc    Update discount and auto-calculate expiration status
exports.updateDiscount = async (req, res) => {
  try {
    // 1. Fetch the existing discount
    const discount = await Discount.findById(req.params.id);
    if (!discount) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    // 2. Apply all new updates from the frontend (date, limits, etc.)
    Object.assign(discount, req.body);

    // 3. Auto-evaluate if it should be Active or Expired
    const now = new Date();
    let isStillValid = true;

    // Check Date Expiration
    if (discount.validTill && new Date(discount.validTill) <= now) {
      isStillValid = false;
    }
    
    // Check Usage Limit Expiration
    if (discount.maxUsage && discount.currentUsage >= discount.maxUsage) {
      isStillValid = false;
    }

    // 4. Smart Status Overrides
    if (isStillValid && discount.status === 'Expired') {
      // If the admin extended the date/usage limit, automatically wake it back up!
      discount.status = 'Active';
    } else if (!isStillValid && discount.status === 'Active') {
      // If the admin backdated it or lowered the limit below current usage, expire it.
      discount.status = 'Expired';
    }
    // Note: If the status is manually set to 'Inactive' (paused) by the admin, 
    // this logic respects that and won't force it to 'Active'.

    // 5. Save the smartly updated document
    await discount.save();

    res.status(200).json(discount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- SYSTEM CONFIG ---
// @route   GET /api/admin/config

exports.getSettings = async (req, res) => {
  try {
    let config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    if (!config) config = await Config.create({ singletonId: 'SYSTEM_CONFIG' });
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

};

// @route   PUT /api/admin/config/:section
exports.updateSettings = async (req, res) => {
  try {
    const { section } = req.params; // 'general', 'payment', 'delivery', 'dynamic'
    const updateData = req.body;

    // Use $set to only update the specific object (e.g., config.payment) without touching the rest

    const config = await Config.findOneAndUpdate(
      { singletonId: 'SYSTEM_CONFIG' },
      { $set: { [section]: updateData } },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Settings updated successfully', config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};