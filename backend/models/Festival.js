const mongoose = require('mongoose');

/**
 * Festival — admin-managed upcoming Hindu festivals.
 *
 * The Gregorian date shifts year-to-year because most Hindu festivals
 * follow the lunar calendar. Admin edits each year's `date` before it
 * rolls around. `isActive=false` hides an entry without deleting it.
 */
const festivalSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    date:        { type: Date,   required: true },
    description: { type: String, default: '', maxlength: 500 },
    imageUrl:    { type: String, default: '' },
    emoji:       { type: String, default: '🪔', maxlength: 8 },
    // Optional link — if set, tapping the banner filters BrowsePoojas
    // to poojas of this category (e.g. 'Ganesh Puja' for Ganesh Chaturthi).
    poojaCategory: { type: String, default: '' },
    isActive:    { type: Boolean, default: true },
    sortOrder:   { type: Number,  default: 0 },
  },
  { timestamps: true }
);

festivalSchema.index({ date: 1, isActive: 1 });

module.exports = mongoose.model('Festival', festivalSchema);
