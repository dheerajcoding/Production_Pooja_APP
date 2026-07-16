const mongoose = require('mongoose');

const panditSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bio: { type: String, default: '', maxlength: 1000 },
    experience: { type: Number, default: 0, min: 0 },
    languages: [{ type: String }],
    expertise: [{ type: String }],
    photo: { type: String, default: '' },
    photoPublicId: { type: String, default: '' },
    isApproved: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    consultationFee: { type: Number, default: 0, min: 0 },  // fee set by admin
    location: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    // Astrology / Live Chat
    isAstrologer:  { type: Boolean, default: false },       // enabled by admin
    astroRate:     { type: Number,  default: 10, min: 1 },  // ₹ per minute, set by admin
    isLiveNow:     { type: Boolean, default: false },       // pandit toggled live

    // Identity verification (KYC)
    aadhaarNumber: { type: String, default: '', trim: true },  // 12 digits
    panNumber:     { type: String, default: '', trim: true, uppercase: true },  // 10 chars

    // Professional details
    education:     { type: String, default: '' },  // Guru / Gurukul / Sanskrit education

    // Address / service area
    currentAddress: {
      street:  { type: String, default: '' },
      city:    { type: String, default: '' },
      state:   { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    operationalCity: { type: String, default: '' },

    // Pricing
    basicDakshinaRate: { type: Number, default: 0, min: 0 },  // base rate for pooja bookings

    // Bank details for settlements
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber:     { type: String, default: '', trim: true },
      ifscCode:          { type: String, default: '', trim: true, uppercase: true },
      upiId:             { type: String, default: '', trim: true },
    },

    // Onboarding declaration
    declarationAccepted:   { type: Boolean, default: false },
    declarationAcceptedAt: { type: Date },
  },
  { timestamps: true }
);

panditSchema.virtual('averageRating').get(function () {
  if (this.totalRatings === 0) return 0;
  return (this.rating / this.totalRatings).toFixed(1);
});

panditSchema.set('toJSON', { virtuals: true });
panditSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Pandit', panditSchema);
