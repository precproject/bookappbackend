const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Customer', 'Admin'], default: 'Customer' },
  status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' },
  referralCode: { type: String, unique: true, sparse: true }, 
  addresses: [{
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  }],
}, { timestamps: true });

// Hash password before saving (FIXED: removed 'next' callback for async hook)
userSchema.pre('save', async function () {
  // If the password hasn't been modified, exit the hook
  if (!this.isModified('password')) return;
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);