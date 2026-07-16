const mongoose = require('mongoose');

/**
 * PoojaCategory — admin-managed pooja category list.
 *
 * Replaces the previous hardcoded enum on Pooja.category so admin can add,
 * rename, or hide categories without a code change. `name` is the display
 * label; `slug` is a lowercase-hyphenated id for URLs and filters.
 * `isActive:false` hides a category without deleting it.
 */
const poojaCategorySchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true, maxlength: 100, unique: true },
    slug:      { type: String, required: true, trim: true, lowercase: true, unique: true },
    emoji:     { type: String, default: '🪔', maxlength: 8 },
    isActive:  { type: Boolean, default: true },
    sortOrder: { type: Number,  default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PoojaCategory', poojaCategorySchema);
