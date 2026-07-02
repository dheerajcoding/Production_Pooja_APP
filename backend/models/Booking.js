const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    panditId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pandit' },
    poojaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pooja', required: true },
    bookingDate: { type: Date, required: true },
    bookingTime: { type: String, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    specialRequirements: { type: String, default: '', maxlength: 500 },
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    cancellationReason: { type: String, default: '' },
    completedAt: { type: Date },
    panditNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ panditId: 1, status: 1 });
bookingSchema.index({ bookingDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
