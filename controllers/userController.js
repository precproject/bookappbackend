const User = require('../models/User');

// @route   GET /api/user/addresses
// @desc    Get all saved addresses for the logged-in user
exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.status(200).json({ addresses: user.addresses || [] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch addresses', error: error.message });
  }
};

// @route   POST /api/user/addresses
// @desc    Add a new address to the user's profile
exports.addAddress = async (req, res) => {
  try {
    const { fullName, phone, street, city, state, pincode } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newAddress = { fullName, phone, street, city, state, pincode };
    
    // Add to the beginning of the array
    user.addresses.unshift(newAddress);
    await user.save();

    res.status(201).json({ message: 'Address saved successfully', addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save address', error: error.message });
  }
};

// GET /api/user/cart
exports.getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('cart');
    res.status(200).json({ cart: user.cart || [] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
};

// PUT /api/user/cart
exports.updateCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.cart = req.body.cart;
    await user.save();
    res.status(200).json({ message: 'Cart synced' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to sync cart' });
  }
};