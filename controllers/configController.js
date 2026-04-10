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
    // Instead of hiding secrets (using minus signs), we specifically 
    // pick ONLY the items the customer is allowed to see.
    const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' })
      .select(`
        general 
        sections 
        shoppingRules 
        taxConfig.isGstEnabled 
        taxConfig.gstPercentage 
        delivery.shippingCharge 
        socialLinks
        uiConfig.showRecentOrdersPopup
        -_id
      `);

    if (!config) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    res.status(200).json(config);
  } catch (error) {
    console.error("Failed to fetch public config:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getConfig,
  updateConfig,
  getPublicConfig
};