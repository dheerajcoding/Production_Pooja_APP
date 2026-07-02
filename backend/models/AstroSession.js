const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole:  { type: String, enum: ['user', 'pandit'], required: true },
    messageType: { type: String, enum: ['text', 'image'], default: 'text' },
    text:        { type: String, default: '', maxlength: 1000 },
    imageUrl:    { type: String, default: '' },
  },
  { timestamps: true }
);

const astroSessionSchema = new mongoose.Schema(
  {
    panditId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pandit', required: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },

    status: {
      type:    String,
      // waiting  → pandit has not yet responded
      // accepted → pandit accepted, waiting for user to pay
      // active   → user paid, chat is live, timer running
      // expired  → 10-min block elapsed, user must recharge to continue
      // ended    → session fully over (either party ended, or no recharge)
      // rejected → pandit rejected the request
      // cancelled→ user cancelled before pandit responded
      enum:    ['waiting', 'accepted', 'active', 'expired', 'ended', 'rejected', 'cancelled'],
      default: 'waiting',
    },

    ratePerMinute:  { type: Number, required: true, min: 1 },  // locked at session start
    blockMinutes:   { type: Number, default: 10 },              // always 10 min per block

    // Tracks paid time
    paidUntil:      { type: Date },       // active until this moment; frontend counts down to this
    totalPaidMinutes: { type: Number, default: 0 },
    totalPaidAmount:  { type: Number, default: 0 },

    // Razorpay — one order at a time (initial or recharge)
    razorpayOrderId: { type: String, default: '' },
    lastPaymentId:   { type: String, default: '' },

    // Session lifecycle
    startTime: { type: Date },    // when chat first went active
    endTime:   { type: Date },
    endedBy:   { type: String, enum: ['user', 'pandit', 'admin', 'timeout', ''], default: '' },
    rejectionNote: { type: String, default: '' },

    messages: [messageSchema],
  },
  { timestamps: true }
);

astroSessionSchema.index({ panditId: 1, status: 1 });
astroSessionSchema.index({ userId:   1, status: 1 });

module.exports = mongoose.model('AstroSession', astroSessionSchema);
