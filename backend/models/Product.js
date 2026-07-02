const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    category: {
      type: String,
      required: true,
      enum: ['Pooja Samagri', 'Flowers & Garlands', 'Incense & Dhoop', 'Clothing', 'Accessories', 'Diyas & Lamps', 'Books & Calendars', 'Food & Prasad', 'Other'],
    },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: 0, min: 0 },
    image: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    stock: { type: Number, default: 0, min: 0 },
    relatedPoojas: [{ type: String }],
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.virtual('finalPrice').get(function () {
  return this.discountPrice > 0 ? this.discountPrice : this.price;
});

productSchema.virtual('discountPercent').get(function () {
  if (this.discountPrice > 0 && this.price > 0) {
    return Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  return 0;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
