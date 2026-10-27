const mongoose = require('mongoose');

const specialPoojaSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 3000 },
    // Admin-managed categories (see PoojaCategory) aren't a fixed set, so this
    // can't be a Mongoose enum — it's free text, optional.
    category:     { type: String, default: '', trim: true, maxlength: 100 },
    price:        { type: Number, required: true, min: 0 },
    duration:     { type: String, default: '' },
    image:        { type: String, default: '' },
    imagePublicId:{ type: String, default: '' },
    language:     { type: String, default: 'Hindi' },
    panditName:   { type: String, default: '' },
    templeLocation:{ type: String, default: '' },        // where pooja is performed
    deliveryDays: { type: Number, default: 3 },          // typical days to complete after booking
    includedItems:[{ type: String }],                    // what is included (prasad, dakshina, etc.)
    isActive:     { type: Boolean, default: true },
    // Package tier — 'premium', 'standard', or '' (regular / uncategorized).
    // Premium and Standard show as their own tabs on the Temple Poojas list.
    packageTier: {
      type: String,
      enum: ['', 'premium', 'standard'],
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OnlinePooja', specialPoojaSchema);
