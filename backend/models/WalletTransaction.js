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

    // Razorpay identifiers (only for topups). No default — left unset for
    // debit/refund entries, so the sparse unique index below only applies
    // to real topup payment ids, never collides across unrelated debits.
    razorpayOrderId:   { type: String },
    razorpayPaymentId: { type: String },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
// Guards against a race where two simultaneous verify calls for the same
// Razorpay payment both pass the findOne-based idempotency check before
// either saves — the unique index makes the second insert fail instead.
walletTransactionSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
