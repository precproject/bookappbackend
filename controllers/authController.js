const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '2d' });
};

// @route   POST /api/auth/register
// @desc    Register a new user (Customer)
exports.registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email or mobile already exists' });
    }

    const user = await User.create({
      name,
      email,
      mobile,
      password,
      role: 'Customer', // Default role
      status: 'Active'
    });

    sendEmail({ to: user.email, subject: `Welcome to ${process.env.STORE_NAME}`, html: templates.welcomeEmail(user.name) }).catch(console.error);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (user.status === 'Disabled') {
        return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
      }
      
      res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/auth/instant-login
// @desc    Passwordless login via email or mobile
// @access  Public
exports.instantLogin = async (req, res) => {
  try {
    const { identifier } = req.body;

    // 1. Validate input
    if (!identifier) {
      return res.status(400).json({ message: 'Please provide an email or mobile number.' });
    }

    // 2. Search the database for the identifier
    const user = await User.findOne({
      $or: [{ email: identifier }, { mobile: identifier }]
    });

    // 3. IF NOT FOUND: Return 404 (React specifically listens for this to show the Register form)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // 🛑 THE SECURITY FIX: Block Admins from using this fast-track door
    if (user.role === 'Admin') {
      return res.status(403).json({ 
        message: 'Please Enter Password or Login via Console.' 
      });
    }
    
    // 4. IF FOUND: Generate token and log them in instantly
    const token = generateToken(user._id);

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Instant Login Error:', error);
    res.status(500).json({ message: 'Server error during instant login.' });
  }
};

// @route   GET /api/auth/profile
// @desc    Get logged in user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};