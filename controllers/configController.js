const Config = require('../models/Config');

// @desc    Get full config (Admin only - includes secrets!)
// @route   GET /api/config
// @access  Private/Admin
const getConfig = async (req, res) => {
  try {
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
    if (!config) return res.status(404).json({ message: 'Configuration not found' });
    
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update config
// @route   PUT /api/config
// @access  Private/Admin
const updateConfig = async (req, res) => {
  try {
    // Only update the specific singleton document to prevent duplicates
    const config = await Config.findOneAndUpdate(
      { singletonId: 'SYSTEM_CONFIG' },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!config) return res.status(404).json({ message: 'Configuration not found' });
    
    res.status(200).json({ 
      message: 'System Configuration updated successfully', 
      config 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// In controllers/configController.js
const getPublicConfig = async (req, res) => {
  try {
    // Stripping the exact keys from the updated schema
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' })
      .select('-payment.saltKey -delivery.apiToken');

    if (!config) return res.status(404).json({ message: 'Configuration not found' });

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getConfig,
  updateConfig,
  getPublicConfig
};