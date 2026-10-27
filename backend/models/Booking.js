const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    panditId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pandit' },
    poojaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pooja', required: true },
    bookingDate: { type: Date, required: true },
    bookingTime: { type: String, required: true },
    // Contact number for THIS booking specifically — may differ from the
    // user's account phone (e.g. booking on behalf of a relative).
    contactPhone: { type: String, required: true, trim: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'confirmed', 'completed', 'cancelled', 'refund_processing', 'refunded'],
      default: 'pending',
    },
    specialRequirements: { type: String, default: '', maxlength: 500 },
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    cancellationReason: { type: String, default: '' },
    completedAt: { type: Date },
    panditNotes: { type: String, default: '' },

    // Admin-initiated partial/full refund (user requests via customer
    // support, admin processes from the dashboard). See adminController.js.
    refund: {
      status:           { type: String, enum: ['none', 'refunded', 'failed'], default: 'none' },
      percent:          { type: Number },
      amount:           { type: Number },
      razorpayRefundId: { type: String },
      refundedAt:       { type: Date },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ panditId: 1, status: 1 });
bookingSchema.index({ bookingDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
