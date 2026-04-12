const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const Config = require('../models/Config'); // <-- Add this at the top

// Helper to generate JWT Token and calculate expiration time
const generateToken = (id) => {
  const expiresInDays = 2;
  const expiresInMinutes = expiresInDays * 24 * 60; // 2880 minutes
  
  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: `${expiresInDays}d` });
  
  return { token, expiresInMinutes };
};

// @route   POST /api/auth/prebook
// @desc    Register for prebook & silently login
// @access  Public
exports.prebookUser = async (req, res) => {
  try {
    const { name, email, mobile } = req.body;

    let user = await User.findOne({ $or: [{ email }, { mobile }] });

    if (user) {
      if (user.isPrebooked) {
        const authData = generateToken(user._id);
        return res.status(200).json({
          alreadyPrebooked: true,
          message: 'You are already on the pre-book list!',
          user,
          token: authData.token
        });
      } else {
        user.isPrebooked = true;
        if(name) user.name = name; 
        if(mobile) user.mobile = mobile;
        
        await user.save();
        const authData = generateToken(user._id);
        
        return res.status(200).json({
          alreadyPrebooked: false,
          message: 'You have been added to the pre-book list!',
          user,
          token: authData.token
        });
      }
    }

    const dummyPassword = Math.random().toString(36).slice(-10) + 'A1!'; 
    
    user = await User.create({
      name,
      email,
      mobile,
      password: dummyPassword,
      isPrebooked: true 
    });

    const authData = generateToken(user._id);

    // --- THE FIX: USING THE STANDARD TEMPLATE ---
    const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    if (systemConfig?.emailAlerts?.welcome !== false) {
      const storeName = process.env.STORE_NAME || 'SahakarStree';
      
      sendEmail({ 
        to: user.email, 
        subject: `तुम्ही प्रतीक्षा यादीत आहात! | Welcome to the Waitlist for ${storeName}`, 
        html: templates.prebookEmail(user.name, storeName) // Perfectly utilizing the standard structure
      }).catch(console.error);
    }

    res.status(201).json({
      alreadyPrebooked: false,
      message: 'Pre-booked successfully and account created!',
      user,
      token: authData.token
    });

  } catch (error) {
    console.error('Prebook Error:', error);
    res.status(500).json({ message: 'Server error during prebooking.' });
  }
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

    // Fetch config to check if Welcome Email is enabled
    const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    
    // Create User...
    
    if (systemConfig?.emailAlerts?.welcome !== false) {
      sendEmail({ 
        to: user.email, 
        subject: `सहकार स्त्री मध्ये आपले स्वागत आहे! | Welcome to ${process.env.STORE_NAME}`, 
        html: templates.welcomeEmail(user.name) 
      }).catch(console.error);
    }

    const authData = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      token: authData.token,
      expiresInMinutes: authData.expiresInMinutes,
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
      
      const authData = generateToken(user._id);

      res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        token: authData.token,
        expiresInMinutes: authData.expiresInMinutes,
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
    const authData = generateToken(user._id);

    res.status(200).json({
      token: authData.token,
      expiresInMinutes: authData.expiresInMinutes,
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

// ==========================================
// NEW ADMIN FEATURES
// ==========================================

// @route   POST /api/auth/create-admin
// @desc    Create a new Admin account securely using the dynamic master secret
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, mobile, password, masterSecret } = req.body;

    // 1. Get the current master key from the database
    const systemConfig = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const requiredSecret = systemConfig?.security?.adminMasterSecret || process.env.ADMIN_MASTER_SECRET;

    if (!requiredSecret) {
     return res.status(500).json({ message: 'Server configuration error: Master secret not set.' });
    }
    
    // 2. Check if the person provided the correct key
    if (masterSecret !== requiredSecret) {
      return res.status(403).json({ message: 'You do not have permission to create an Admin account.' });
    }

    const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (userExists) {
      return res.status(400).json({ message: 'An account with this email or mobile already exists.' });
    }

    // 3. Hand them the manager's badge
    const adminUser = await User.create({
      name,
      email,
      mobile,
      password,
      role: 'Admin', // System forces this to be an Admin
      status: 'Active'
    });

    res.status(201).json({
      message: 'Admin account created successfully.',
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/auth/admin/change-password
// @desc    Change password for a logged-in Admin
// @access  Private (Requires user to be logged in via middleware)
exports.changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Find the user who is currently logged in
    const user = await User.findById(req.user._id);

    // Make sure they are actually a manager
    if (!user || user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can use this feature.' });
    }

    // Verify they have the correct old key before cutting a new one
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }

    // Change the lock
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Admin password has been changed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};