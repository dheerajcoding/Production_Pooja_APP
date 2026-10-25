const crypto = require('crypto');
const Razorpay = require('razorpay');
const OfflineBooking = require('../models/OfflineBooking');
const Pandit = require('../models/Pandit');

const getRazorpay = () =>
  new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

const ALLOWED_REFUND_PERCENTS = [100, 70, 50];

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// Browse all approved + available pandits with their admin-set fee
exports.getAvailablePandits = async (req, res) => {
  const pandits = await Pandit.find({ isApproved: true, isAvailable: true })
    .populate('userId', 'name email phone profilePhoto')
    .sort({ rating: -1 });

  res.json({ success: true, data: pandits });
};

// ─── USER ─────────────────────────────────────────────────────────────────────

// Step 1 — User sends a booking request (no payment yet)
exports.createBooking = async (req, res) => {
  const { panditId, eventType, bookingDate, bookingTime, address, requirements } = req.body;

  if (!panditId || !eventType || !bookingDate || !bookingTime || !address) {
    return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
  }

  const pandit = await Pandit.findById(panditId);
  if (!pandit || !pandit.isApproved || !pandit.isAvailable) {
    return res.status(404).json({ success: false, message: 'Pandit not found or not available.' });
  }

  if (pandit.consultationFee <= 0) {
    return res.status(400).json({ success: false, message: 'This pandit does not have a fee set. Please contact admin.' });
  }

  const date = new Date(bookingDate);
  if (date < new Date()) {
    return res.status(400).json({ success: false, message: 'Booking date must be in the future.' });
  }

  const booking = await OfflineBooking.create({
    userId:   req.user._id,
    panditId,
    eventType,
    bookingDate: date,
    bookingTime,
    address,
    requirements: requirements || '',
    amount: pandit.consultationFee,   // locked from admin-set fee
    status: 'requested',              // pandit must accept before payment
  });

  res.status(201).json({ success: true, message: 'Request sent! Waiting for pandit to accept.', data: booking });
};

// Get user's offline bookings
exports.getMyOfflineBookings = async (req, res) => {
  const bookings = await OfflineBooking.find({ userId: req.user._id })
    .populate({
      path: 'panditId',
      populate: { path: 'userId', select: 'name email phone profilePhoto' },
    })
    .sort({ createdAt: -1 });

  res.json({ success: true, data: bookings });
};

// Cancel — only if requested or accepted (unpaid)
exports.cancelOfflineBooking = async (req, res) => {
  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }
  if (booking.isPaid) {
    return res.status(400).json({ success: false, message: 'Paid bookings cannot be cancelled. Please contact support.' });
  }
  if (!['requested', 'accepted'].includes(booking.status)) {
    return res.status(400).json({ success: false, message: 'This booking cannot be cancelled.' });
  }
  booking.status = 'cancelled';
  await booking.save();
  res.json({ success: true, message: 'Booking cancelled.', data: booking });
};

// Step 3 — Create Razorpay order (only after pandit has accepted)
exports.createPayment = async (req, res) => {
  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }
  if (booking.isPaid) {
    return res.status(400).json({ success: false, message: 'Already paid.' });
  }
  if (booking.status !== 'accepted') {
    return res.status(400).json({ success: false, message: 'Pandit must accept the request before payment.' });
  }

  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount:   Math.round(booking.amount * 100),
    currency: 'INR',
    receipt:  `offline_${booking._id}`,
  });

  booking.razorpayOrderId = order.id;
  await booking.save();

  res.json({
    success: true,
    data: {
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      keyId:     process.env.RAZORPAY_KEY_ID,
      bookingId: booking._id,
    },
  });
};

// Step 4 — Verify payment and confirm booking
exports.verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  if (booking.isPaid) {
    return res.json({ success: true, message: 'Already paid.', data: booking });
  }
  if (booking.razorpayOrderId !== razorpayOrderId) {
    return res.status(400).json({ success: false, message: 'This payment does not match this booking.' });
  }

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSig !== razorpaySignature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed.' });
  }

  booking.isPaid            = true;
  booking.status            = 'confirmed';
  booking.razorpayOrderId   = razorpayOrderId;
  booking.razorpayPaymentId = razorpayPaymentId;
  booking.razorpaySignature = razorpaySignature;
  await booking.save();

  res.json({ success: true, message: 'Payment confirmed! Booking is confirmed.', data: booking });
};

// ─── PANDIT ───────────────────────────────────────────────────────────────────

// Get offline bookings for pandit (all statuses or filtered)
exports.getPanditBookings = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const filter = { panditId: pandit._id };
  if (req.query.status) filter.status = req.query.status;

  const limit = parseInt(req.query.limit) || 20;
  const page  = parseInt(req.query.page)  || 1;

  const total    = await OfflineBooking.countDocuments(filter);
  // Pandits never see the booking's rupee amount — only the devotee/admin do.
  const bookings = await OfflineBooking.find(filter)
    .select('-amount')
    .populate('userId', 'name email phone profilePhoto')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    },
  });
};

// Step 2a — Pandit accepts the request (fee already fixed by admin)
exports.acceptRequest = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.panditId.toString() !== pandit._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }
  if (booking.status !== 'requested') {
    return res.status(400).json({ success: false, message: 'Only requested bookings can be accepted.' });
  }

  booking.status = 'accepted';
  if (req.body.note) booking.panditNote = req.body.note;
  await booking.save();

  const data = booking.toObject();
  delete data.amount; // pandits never see the booking's rupee amount
  res.json({ success: true, message: 'Request accepted. User will be notified to complete payment.', data });
};

// Step 2b — Pandit rejects the request
exports.rejectRequest = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.panditId.toString() !== pandit._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }
  if (booking.status !== 'requested') {
    return res.status(400).json({ success: false, message: 'Only requested bookings can be rejected.' });
  }

  booking.status = 'rejected';
  if (req.body.reason) booking.rejectionReason = req.body.reason;
  await booking.save();

  const data = booking.toObject();
  delete data.amount; // pandits never see the booking's rupee amount
  res.json({ success: true, message: 'Request rejected.', data });
};

// Pandit marks confirmed booking as completed
exports.markOfflineComplete = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.panditId.toString() !== pandit._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ success: false, message: 'Only confirmed bookings can be marked complete.' });
  }

  booking.status      = 'completed';
  booking.completedAt = new Date();
  if (req.body.note) booking.panditNote = req.body.note;
  await booking.save();

  pandit.completedBookings += 1;
  pandit.totalBookings     += 1;
  pandit.earnings          += booking.amount;
  await pandit.save();

  const data = booking.toObject();
  delete data.amount; // pandits never see the booking's rupee amount
  res.json({ success: true, message: 'Booking marked as completed.', data });
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

exports.getAllOfflineBookings = async (req, res) => {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 15;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const total    = await OfflineBooking.countDocuments(filter);
  const bookings = await OfflineBooking.find(filter)
    .populate('userId', 'name email phone')
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name email phone' } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    },
  });
};

exports.adminUpdateOfflineStatus = async (req, res) => {
  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  const { status, adminNote } = req.body;
  if (status) {
    const valid = ['requested', 'accepted', 'rejected', 'confirmed', 'completed', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
    booking.status = status;
  }
  if (adminNote !== undefined) booking.adminNote = adminNote;
  await booking.save();

  res.json({ success: true, message: 'Booking updated.', data: booking });
};

// Admin-initiated refund — the user requests this by contacting customer
// support (phone/email), not through the app. Admin picks 100/70/50% and
// this calls Razorpay's Refunds API against the original payment.
exports.refundOfflineBooking = async (req, res) => {
  const percent = Number(req.body.percent);
  if (!ALLOWED_REFUND_PERCENTS.includes(percent)) {
    return res.status(400).json({ success: false, message: 'Refund percent must be 100, 70, or 50.' });
  }

  const booking = await OfflineBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (!booking.isPaid || !booking.razorpayPaymentId) {
    return res.status(400).json({ success: false, message: 'This booking was never paid.' });
  }
  if (booking.refund?.status === 'refunded') {
    return res.status(400).json({ success: false, message: 'This booking has already been refunded.' });
  }

  const amountRupees = Math.round(booking.amount * percent) / 100;
  const amountPaise  = Math.round(amountRupees * 100);

  let refund;
  try {
    refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
      amount: amountPaise,
      speed: 'normal',
      notes: { bookingId: String(booking._id), percent: String(percent) },
    });
  } catch (err) {
    booking.refund = { status: 'failed', percent, amount: amountRupees };
    await booking.save();
    return res.status(502).json({
      success: false,
      message: err?.error?.description || 'Razorpay refund request failed. Please try again.',
    });
  }

  booking.refund = {
    status: 'refunded',
    percent,
    amount: amountRupees,
    razorpayRefundId: refund.id,
    refundedAt: new Date(),
  };
  await booking.save();

  res.json({
    success: true,
    message: `₹${amountRupees} (${percent}%) refunded successfully.`,
    data: booking,
  });
};
