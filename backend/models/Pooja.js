const mongoose = require('mongoose');

const poojaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    category: {
      type: String,
      required: true,
      enum: ['Griha Pravesh', 'Satyanarayan Katha', 'Navratri', 'Ganesh Puja', 'Laxmi Puja', 'Shradh', 'Vivah', 'Namkaran', 'Mundan', 'Other'],
    },
    duration: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    includedItems: [{ type: String }],
    isActive: { type: Boolean, default: true },
    bookingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pooja', poojaSchema);
