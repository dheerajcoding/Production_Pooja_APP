const mongoose = require('mongoose');

const offlineBookingSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  panditId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Pandit', required: true },
  eventType:   { type: String, required: true, trim: true },
  bookingDate: { type: Date,   required: true },
  bookingTime: { type: String, required: true },
  address: {
    street:   { type: String, required: true },
    city:     { type: String, required: true },
    state:    { type: String, required: true },
    pincode:  { type: String, required: true },
    landmark: { type: String, default: '' },
  },
  requirements: { type: String, default: '', maxlength: 1000 },

  // Amount locked from admin-set consultationFee at booking time
  amount:  { type: Number, required: true, min: 0 },
  isPaid:  { type: Boolean, default: false },

  // Razorpay
  razorpayOrderId:   { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },

  // Flow: requested → accepted → confirmed (paid) → completed
  //                ↘ rejected
  //        requested/accepted (unpaid) → cancelled
  status: {
    type: String,
    enum: ['requested', 'accepted', 'rejected', 'confirmed', 'completed', 'cancelled'],
    default: 'requested',
  },

  rejectionReason: { type: String, default: '' },
  panditNote:      { type: String, default: '' },
  adminNote:       { type: String, default: '' },
  completedAt:     { type: Date },
}, { timestamps: true });

offlineBookingSchema.index({ userId: 1, status: 1 });
offlineBookingSchema.index({ panditId: 1, status: 1 });

module.exports = mongoose.model('OfflineBooking', offlineBookingSchema);
