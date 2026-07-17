const mongoose = require('mongoose');

const poojaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    // No enum — categories are managed dynamically via /api/pooja-categories
    // by admin. Stored as the display name (e.g., "Ganesh Puja"). If admin
    // renames a category, poojaCategoryController.update cascades the rename
    // to all poojas that referenced it.
    category: { type: String, required: true, trim: true, maxlength: 100 },
    duration: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    includedItems: [{ type: String }],
    isActive: { type: Boolean, default: true },
    // Whether this pooja appears in the user dashboard's featured banner slider.
    // Admin toggles via PUT /api/poojas/:id { isFeatured: true }.
    isFeatured: { type: Boolean, default: false },
    // Package tier — 'premium', 'standard', or '' (regular / uncategorized).
    // Premium and Standard show as their own tabs on BrowsePoojas.
    packageTier: {
      type: String,
      enum: ['', 'premium', 'standard'],
      default: '',
    },
    bookingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pooja', poojaSchema);
