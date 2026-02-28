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

    // Ensure the user has an addresses list to look through
    if (!user.addresses) {
      user.addresses = [];
    }

    // Flip through the diary to check if this exact address is already written down
    const isDuplicate = user.addresses.some((addr) => {
      return (
        addr.street.trim().toLowerCase() === street.trim().toLowerCase() &&
        addr.city.trim().toLowerCase() === city.trim().toLowerCase() &&
        addr.pincode.trim() === pincode.trim()
      );
    });

    // If we already have it, just say success and return what we have
    if (isDuplicate) {
      return res.status(200).json({ 
        message: 'Address already exists', 
        addresses: user.addresses 
      });
    }

    // If we couldn't find it, it's a new house! Let's write it down.
    const newAddress = { fullName, phone, street, city, state, pincode };
    
    // Add to the top of the list
    user.addresses.unshift(newAddress);
    await user.save();

    res.status(201).json({ 
      message: 'Address saved successfully', 
      addresses: user.addresses 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save address', error: error.message });
  }
};

// @route   DELETE /api/user/addresses/:id
// @desc    Remove an address from user profile
exports.deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Filter out the address either by its MongoDB _id or by array index
    user.addresses = user.addresses.filter((addr, index) => 
      addr._id.toString() !== req.params.id && index.toString() !== req.params.id
    );

    await user.save();
    res.status(200).json({ message: 'Address removed', addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete address' });
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