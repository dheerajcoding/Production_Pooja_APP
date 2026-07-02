const crypto = require('crypto');
const Razorpay = require('razorpay');
const OfflineBooking = require('../models/OfflineBooking');
const Pandit = require('../models/Pandit');

const getRazorpay = () =>
  new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

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
  const bookings = await OfflineBooking.find(filter)
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

  res.json({ success: true, message: 'Request accepted. User will be notified to complete payment.', data: booking });
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

  res.json({ success: true, message: 'Request rejected.', data: booking });
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

  res.json({ success: true, message: 'Booking marked as completed.', data: booking });
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
