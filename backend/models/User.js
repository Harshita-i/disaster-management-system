const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['victim', 'ngo', 'admin'], default: 'victim' },
  // NGO-specific
  ngoName:  { type: String },
  approved: { type: Boolean, default: false }, // admin must approve NGOs
  // location (victim)
  blocked: { type: Boolean, default: false },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    updatedAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password helper
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);