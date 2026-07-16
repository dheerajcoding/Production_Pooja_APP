const User               = require('../models/User');
const WalletTransaction  = require('../models/WalletTransaction');
const Razorpay           = require('razorpay');
const crypto             = require('crypto');

const getRazorpay = () => new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const MIN_TOPUP = 50;
const MAX_TOPUP = 100000;
const GST_RATE  = 0.18;    // 18% GST added on top of the wallet top-up amount

// Deterministic rupee math: return whole-rupee totals to keep Razorpay's
// amount (paise) exact and the client's displayed breakdown consistent.
function computeTotals(baseAmount) {
  const base  = Math.round(baseAmount);              // wallet credit
  const gst   = Math.round(base * GST_RATE);          // 18% GST rounded to nearest ₹1
  const total = base + gst;                           // amount user actually pays
  return { base, gst, total, gstRatePercent: 18 };
}

/* ─────────────────────────────────────────────
   GET /api/wallet/balance
───────────────────────────────────────────── */
exports.getBalance = async (req, res) => {
  const user = await User.findById(req.user._id).select('walletBalance');
  res.json({
    success: true,
    data: { balance: user?.walletBalance || 0 },
  });
};

/* ─────────────────────────────────────────────
   POST /api/wallet/topup/create
   Body: { amount }         (base top-up amount user selected)
   Charges base + 18% GST to Razorpay. Wallet gets credited only the base.
───────────────────────────────────────────── */
exports.createTopupOrder = async (req, res) => {
  const baseInput = Number(req.body.amount);

  if (!Number.isFinite(baseInput) || baseInput < MIN_TOPUP) {
    return res.status(400).json({ success: false, message: `Minimum top-up amount is ₹${MIN_TOPUP}.` });
  }
  if (baseInput > MAX_TOPUP) {
    return res.status(400).json({ success: false, message: `Maximum top-up amount is ₹${MAX_TOPUP}.` });
  }

  const { base, gst, total, gstRatePercent } = computeTotals(baseInput);

  // receipt must be ≤ 40 chars — use last 8 chars of user ID + epoch seconds
  const receipt = `tp_${String(req.user._id).slice(-8)}_${Math.floor(Date.now() / 1000)}`;

  const order = await getRazorpay().orders.create({
    amount:   total * 100,               // paise — user pays total (base + GST)
    currency: 'INR',
    receipt,
    notes: {
      userId:   String(req.user._id),
      purpose:  'wallet_topup',
      baseAmt:  String(base),
      gstAmt:   String(gst),
      totalAmt: String(total),
    },
  });

  res.json({
    success: true,
    data: {
      orderId:        order.id,
      amount:         order.amount,   // total in paise — what Razorpay charges
      currency:       order.currency,
      keyId:          process.env.RAZORPAY_KEY_ID,
      base,                            // credited to wallet on verify
      gst,                             // 18% government tax
      total,                           // what the user actually pays
      gstRatePercent,                  // 18 — for display
    },
  });
};

/* ─────────────────────────────────────────────
   POST /api/wallet/topup/verify
   Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount }
───────────────────────────────────────────── */
exports.verifyTopupPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const baseInput = Number(req.body.amount);   // base top-up (credited to wallet)

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment details.' });
  }
  if (!Number.isFinite(baseInput) || baseInput < MIN_TOPUP) {
    return res.status(400).json({ success: false, message: 'Invalid top-up amount.' });
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed.' });
  }

  const { base, gst, total } = computeTotals(baseInput);

  // Prevent double-credit on retry
  const existing = await WalletTransaction.findOne({ razorpayPaymentId: razorpay_payment_id });
  if (existing) {
    const user = await User.findById(req.user._id).select('walletBalance');
    return res.json({
      success: true,
      data: { balance: user.walletBalance, transaction: existing, base, gst, total },
      message: 'Top-up already credited.',
    });
  }

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  // Credit ONLY the base amount to the wallet. GST is a pass-through tax
  // paid to the government, not part of the user's spendable wallet.
  user.walletBalance = (user.walletBalance || 0) + base;
  await user.save();

  const txn = await WalletTransaction.create({
    userId:            user._id,
    type:              'topup',
    amount:            base,
    balanceAfter:      user.walletBalance,
    referenceType:     'topup',
    description:       `Wallet top-up ₹${base} (paid ₹${total} = ₹${base} + ₹${gst} GST @ 18%)`,
    razorpayOrderId:   razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  });

  res.json({
    success: true,
    data: { balance: user.walletBalance, transaction: txn, base, gst, total },
    message: `₹${base} added to your wallet.`,
  });
};

/* ─────────────────────────────────────────────
   GET /api/wallet/transactions?page=1&limit=20
───────────────────────────────────────────── */
exports.getTransactions = async (req, res) => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const [transactions, total] = await Promise.all([
    WalletTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    WalletTransaction.countDocuments({ userId: req.user._id }),
  ]);

  res.json({
    success: true,
    data: {
      transactions,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    },
  });
};
