const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // topup   → user added money via Razorpay
    // debit   → deducted for an astro chat block
    // refund  → unused reserved minutes returned to wallet on session end
    type: {
      type: String,
      enum: ['topup', 'debit', 'refund'],
      required: true,
    },

    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },

    // What this transaction relates to
    referenceType: {
      type: String,
      enum: ['topup', 'astro_session', ''],
      default: '',
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },

    description: { type: String, default: '' },

    // Razorpay identifiers (only for topups)
    razorpayOrderId:   { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
