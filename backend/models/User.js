const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Not required for Google-signed-up accounts (no password to compare against).
    password: {
      type: String,
      required: function () { return !this.googleId; },
      minlength: 6,
      select: false,
    },
    // Google account id ("sub" claim) — set only for accounts created/linked
    // via Sign in with Google. sparse so plain email/password accounts
    // (where this is never set) don't collide on the unique index.
    googleId: { type: String, unique: true, sparse: true, select: false },
    phone: { type: String, trim: true },
    role: { type: String, enum: ['user', 'pandit', 'admin'], default: 'user' },
    profilePhoto: { type: String, default: '' },
    profilePhotoPublicId: { type: String, default: '' },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
    walletBalance: { type: Number, default: 0, min: 0 },
    // One-time free astrology trial (5 min) — consumed the first time this
    // user ever activates a chat session. See astroController.js.
    hasUsedFreeAstroTrial: { type: Boolean, default: false },
    resetPasswordOTP: { type: String, select: false },
    resetPasswordOTPExpiry: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetOTP = function () {
  const otp = crypto.randomInt(100000, 1000000).toString();
  this.resetPasswordOTP = crypto.createHash('sha256').update(otp).digest('hex');
  this.resetPasswordOTPExpiry = Date.now() + 10 * 60 * 1000;
  return otp;
};

module.exports = mongoose.model('User', userSchema);
