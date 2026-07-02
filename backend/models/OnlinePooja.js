const mongoose = require('mongoose');

const specialPoojaSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 3000 },
    category: {
      type: String,
      required: true,
      enum: ['Griha Pravesh', 'Satyanarayan Katha', 'Navratri', 'Ganesh Puja', 'Laxmi Puja',
             'Shradh', 'Vivah', 'Namkaran', 'Mundan', 'Rudrabhishek', 'Sundarkand Path', 'Other'],
    },
    price:        { type: Number, required: true, min: 0 },
    duration:     { type: String, required: true, default: '1-2 hours' },
    image:        { type: String, default: '' },
    imagePublicId:{ type: String, default: '' },
    language:     { type: String, default: 'Hindi' },
    panditName:   { type: String, default: '' },
    templeLocation:{ type: String, default: '' },        // where pooja is performed
    deliveryDays: { type: Number, default: 3 },          // typical days to complete after booking
    includedItems:[{ type: String }],                    // what is included (prasad, dakshina, etc.)
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OnlinePooja', specialPoojaSchema);
