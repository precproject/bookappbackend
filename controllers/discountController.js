const Discount = require('../models/Discount');
const Referral = require('../models/Referral');

// @route   POST /api/discounts/validate
// @desc    Check a discount code and return the amount saved
exports.validatePromo = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    
    // SAFETY CHECK 1: Ensure we have a code AND a valid, positive subtotal
    if (!code) return res.status(400).json({ message: 'Code is required' });
    if (!subtotal || isNaN(subtotal) || subtotal <= 0) {
      return res.status(400).json({ message: 'Invalid cart total' });
    }

    const upperCode = code.toUpperCase();

    // 1. Check Standard Discounts
    let discount = await Discount.findOne({ code: upperCode, status: 'Active' });
    let discountAmount = 0;

    if (discount) {
      // Check expiration
      if (discount.validTill && new Date(discount.validTill) <= new Date()) {
        discount.status = 'Expired';
        await discount.save();
        return res.status(400).json({ message: 'This code has expired' });
      }
      // Check usage limits
      if (discount.maxUsage && discount.currentUsage >= discount.maxUsage) {
        discount.status = 'Expired';
        await discount.save();
        return res.status(400).json({ message: 'This code usage limit has been reached' });
      }

      // Calculate Amount
      if (discount.type === 'Percentage') {
        discountAmount = (subtotal * discount.value) / 100;
        if (discount.maxDiscount) discountAmount = Math.min(discountAmount, discount.maxDiscount);
      } else {
        // SAFETY CHECK 2: Ensure a flat discount is never bigger than the cart total
        discountAmount = Math.min(discount.value, subtotal);
      }
      
      return res.status(200).json({ discountAmount: Math.round(discountAmount) });
    }

    // 2. If not a standard discount, check if it's a Referral Code allowed as a discount
    const referral = await Referral.findOne({ code: upperCode, status: 'Active' });
    
    if (referral && referral.isDiscountLinked) {
      
      // SAFETY CHECK 3: Prevent a user from applying their own referral code
      // (This assumes your route knows who is logged in via req.user)
      if (req.user && referral.user.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'You cannot use your own referral code.' });
      }

      // Apply the referral reward rate as a flat discount to the buyer
      discountAmount = referral.rewardRate;
      
      // Ensure we don't discount more than the subtotal
      discountAmount = Math.min(discountAmount, subtotal);
      
      return res.status(200).json({ discountAmount: Math.round(discountAmount), isReferral: true });
    }

    // 3. Neither found
    return res.status(404).json({ message: 'Invalid or inactive promo code' });

  } catch (error) {
    res.status(500).json({ message: 'Failed to validate promo', error: error.message });
  }
};