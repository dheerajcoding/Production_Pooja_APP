const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    isPaid: { type: Boolean, default: false },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    deliveryNotes: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },
    deliveredAt: { type: Date },

    // Admin-initiated partial/full refund (user requests via customer
    // support, admin processes from the dashboard). See orderController.js.
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

orderSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
