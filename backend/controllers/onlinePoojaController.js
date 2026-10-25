const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const OnlinePooja = require('../models/OnlinePooja');
const OnlineBooking = require('../models/OnlineBooking');
const Pandit = require('../models/Pandit');

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ALLOWED_REFUND_PERCENTS = [100, 70, 50];

const getImageUrl = (req, filename) => {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/poojas/${path.basename(filename)}`;
};
const getVideoUrl = (req, filename) => {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/videos/${path.basename(filename)}`;
};
const getCompletionImageUrl = (req, filename) => {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/completions/${path.basename(filename)}`;
};

const deleteOldFile = (folder, filename) => {
  if (!filename) return;
  const fp = path.join(__dirname, `../uploads/${folder}`, path.basename(filename));
  if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
};

// ── Public ────────────────────────────────────────────────────────────────────

exports.getAllOnlinePoojas = async (req, res) => {
  const { page = 1, limit = 9, category, tier } = req.query;
  const query = { isActive: true };
  if (category) query.category = category;
  if (tier === 'premium' || tier === 'standard') query.packageTier = tier;

  const poojas = await OnlinePooja.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await OnlinePooja.countDocuments(query);

  res.json({
    success: true,
    data: {
      poojas,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

// Admin management listing — includes inactive online poojas (so a
// deactivated one can still be found and reactivated) and a real limit.
exports.getAllOnlinePoojasAdmin = async (req, res) => {
  const { page = 1, limit = 100, category } = req.query;
  const query = {};
  if (category) query.category = category;

  const poojas = await OnlinePooja.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await OnlinePooja.countDocuments(query);

  res.json({
    success: true,
    data: {
      poojas,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.getOnlinePoojaById = async (req, res) => {
  const pooja = await OnlinePooja.findById(req.params.id);
  if (!pooja) return res.status(404).json({ success: false, message: 'Special pooja not found.' });
  res.json({ success: true, data: pooja });
};

// ── User: Book & Pay ──────────────────────────────────────────────────────────

exports.bookOnlinePooja = async (req, res) => {
  const { preferredDate, gotraName, wishes, memberNames, address } = req.body;

  if (!address || !address.trim()) {
    return res.status(400).json({ success: false, message: 'Delivery address is required for prasad & certificates.' });
  }

  const pooja = await OnlinePooja.findById(req.params.id);
  if (!pooja || !pooja.isActive) {
    return res.status(404).json({ success: false, message: 'Special pooja not found or currently unavailable.' });
  }

  const booking = await OnlineBooking.create({
    userId: req.user._id,
    onlinePoojaId: pooja._id,
    amount: pooja.price,
    preferredDate: preferredDate ? new Date(preferredDate) : undefined,
    gotraName: gotraName || '',
    wishes: wishes || '',
    memberNames: memberNames || '',
    address: address || '',
  });

  res.status(201).json({ success: true, message: 'Booking created. Proceed to payment.', data: booking });
};

exports.createOnlineBookingPayment = async (req, res) => {
  const { bookingId } = req.body;
  const booking = await OnlineBooking.findOne({ _id: bookingId, userId: req.user._id });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.isPaid) return res.status(400).json({ success: false, message: 'Already paid.' });

  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount: Math.round(booking.amount * 100),
    currency: 'INR',
    receipt: `sp_${bookingId}`,
  });

  booking.razorpayOrderId = order.id;
  await booking.save();

  res.json({
    success: true,
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingId: booking._id,
    },
  });
};

exports.verifyOnlineBookingPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSig !== razorpaySignature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed.' });
  }

  const booking = await OnlineBooking.findOne({ _id: bookingId, userId: req.user._id });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.razorpayOrderId !== razorpayOrderId) {
    return res.status(400).json({ success: false, message: 'This payment does not match this booking.' });
  }
  if (booking.isPaid) {
    return res.json({ success: true, message: 'Already paid.', data: booking });
  }

  booking.isPaid = true;
  booking.status = 'confirmed';
  booking.razorpayPaymentId = razorpayPaymentId;
  booking.razorpaySignature = razorpaySignature;
  await booking.save();

  res.json({ success: true, message: 'Payment confirmed! Your pooja has been booked.', data: booking });
};

exports.getMyOnlineBookings = async (req, res) => {
  const bookings = await OnlineBooking.find({ userId: req.user._id })
    .populate('onlinePoojaId')
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo experience' })
    .sort({ createdAt: -1 });

  res.json({ success: true, data: bookings });
};

// ── Admin: Manage Special Poojas ──────────────────────────────────────────────

exports.createOnlinePooja = async (req, res) => {
  const {
    name, description, category, price, duration, language,
    panditName, templeLocation, deliveryDays, includedItems, packageTier,
  } = req.body;

  const data = {
    name, description, category,
    price: parseFloat(price),
    duration,
    language,
    panditName,
    templeLocation,
    deliveryDays: parseInt(deliveryDays) || 3,
    packageTier: ['premium', 'standard'].includes(packageTier) ? packageTier : '',
    includedItems: includedItems
      ? (Array.isArray(includedItems) ? includedItems : includedItems.split(',').map((i) => i.trim()).filter(Boolean))
      : [],
  };

  if (req.file) {
    data.image = getImageUrl(req, req.file.filename);
    data.imagePublicId = req.file.filename;
  }

  const pooja = await OnlinePooja.create(data);
  res.status(201).json({ success: true, message: 'Special pooja created.', data: pooja });
};

exports.updateOnlinePooja = async (req, res) => {
  const pooja = await OnlinePooja.findById(req.params.id);
  if (!pooja) return res.status(404).json({ success: false, message: 'Not found.' });

  const fields = ['name', 'description', 'category', 'duration', 'language', 'panditName', 'templeLocation', 'isActive'];
  fields.forEach((f) => { if (req.body[f] !== undefined) pooja[f] = req.body[f]; });
  if (req.body.price)        pooja.price        = parseFloat(req.body.price);
  if (req.body.deliveryDays) pooja.deliveryDays  = parseInt(req.body.deliveryDays);
  if (req.body.packageTier !== undefined) {
    pooja.packageTier = ['premium', 'standard'].includes(req.body.packageTier) ? req.body.packageTier : '';
  }
  if (req.body.includedItems) {
    pooja.includedItems = Array.isArray(req.body.includedItems)
      ? req.body.includedItems
      : req.body.includedItems.split(',').map((i) => i.trim()).filter(Boolean);
  }

  if (req.file) {
    deleteOldFile('poojas', pooja.imagePublicId);
    pooja.image = getImageUrl(req, req.file.filename);
    pooja.imagePublicId = req.file.filename;
  }

  await pooja.save();
  res.json({ success: true, message: 'Special pooja updated.', data: pooja });
};

exports.deleteOnlinePooja = async (req, res) => {
  const pooja = await OnlinePooja.findById(req.params.id);
  if (!pooja) return res.status(404).json({ success: false, message: 'Not found.' });
  deleteOldFile('poojas', pooja.imagePublicId);
  await pooja.deleteOne();
  res.json({ success: true, message: 'Special pooja deleted.' });
};

// ── Admin: Manage Bookings ────────────────────────────────────────────────────

exports.getAllOnlineBookingsAdmin = async (req, res) => {
  const { page = 1, limit = 20, status, poojaId } = req.query;
  const query = {};
  if (status) query.status = status;
  if (poojaId) query.onlinePoojaId = poojaId;

  const bookings = await OnlineBooking.find(query)
    .populate('userId', 'name email phone')
    .populate('onlinePoojaId', 'name category price templeLocation')
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo experience' })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await OnlineBooking.countDocuments(query);
  res.json({
    success: true,
    data: {
      bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.updateBookingStatus = async (req, res) => {
  const { status, adminNote } = req.body;
  const booking = await OnlineBooking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  if (status) booking.status = status;
  if (adminNote !== undefined) booking.adminNote = adminNote;
  await booking.save();

  res.json({ success: true, message: 'Booking updated.', data: booking });
};

// Admin-initiated refund — the user requests this by contacting customer
// support (phone/email), not through the app. Admin picks 100/70/50% and
// this calls Razorpay's Refunds API against the original payment.
exports.refundBooking = async (req, res) => {
  const percent = Number(req.body.percent);
  if (!ALLOWED_REFUND_PERCENTS.includes(percent)) {
    return res.status(400).json({ success: false, message: 'Refund percent must be 100, 70, or 50.' });
  }

  const booking = await OnlineBooking.findById(req.params.bookingId);
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

// Upload a video file to a specific booking — the proof for the user
exports.uploadVideoToBooking = async (req, res) => {
  const booking = await OnlineBooking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  // Delete old video file if it exists
  if (booking.videoFile) {
    deleteOldFile('videos', booking.videoFile);
  }

  if (req.file) {
    // Admin uploaded an actual video file
    booking.videoFile        = req.file.filename;
    booking.videoOriginalName= req.file.originalname;
    booking.videoUrl         = getVideoUrl(req, req.file.filename);
    booking.videoExternalUrl = '';
  } else if (req.body.videoExternalUrl) {
    // Admin provided an external link (YouTube / Drive)
    booking.videoExternalUrl = req.body.videoExternalUrl;
    booking.videoFile        = '';
    booking.videoOriginalName= '';
    booking.videoUrl         = '';
  } else {
    return res.status(400).json({ success: false, message: 'Provide either a video file or an external URL.' });
  }

  booking.videoUploadedAt = new Date();
  booking.completedAt = booking.completedAt || new Date();
  booking.status = 'completed';
  await booking.save();

  res.json({ success: true, message: 'Video uploaded. User can now view and download it.', data: booking });
};

// ── Admin: Pandit assignment ──────────────────────────────────────────────────

exports.assignPanditToBooking = async (req, res) => {
  const { panditId } = req.body;
  if (!panditId) {
    return res.status(400).json({ success: false, message: 'panditId is required.' });
  }
  const pandit = await Pandit.findById(panditId);
  if (!pandit) {
    return res.status(404).json({ success: false, message: 'Pandit not found.' });
  }
  if (!pandit.isApproved) {
    return res.status(400).json({ success: false, message: 'Cannot assign an unapproved pandit.' });
  }
  const booking = await OnlineBooking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (!booking.isPaid) {
    return res.status(400).json({ success: false, message: 'Cannot assign a pandit before payment is received.' });
  }

  booking.panditId = panditId;
  booking.assignedBy = req.user?._id;
  booking.assignedAt = new Date();
  if (booking.status === 'pending' || booking.status === 'confirmed') {
    booking.status = 'assigned';
  }
  await booking.save();

  const populated = await OnlineBooking.findById(booking._id)
    .populate('userId', 'name email phone')
    .populate('onlinePoojaId', 'name category price templeLocation')
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo experience' });

  res.json({ success: true, message: 'Pandit assigned successfully.', data: populated });
};

// ── Admin: Completion images ──────────────────────────────────────────────────

exports.uploadCompletionImagesToBooking = async (req, res) => {
  const booking = await OnlineBooking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ success: false, message: 'At least one image is required.' });
  }

  const newImages = files.map((f) => ({
    filename: f.filename,
    url: getCompletionImageUrl(req, f.filename),
    caption: '',
    uploadedAt: new Date(),
  }));
  booking.completionImages = [...(booking.completionImages || []), ...newImages];
  await booking.save();

  res.json({ success: true, message: `${files.length} image(s) uploaded.`, data: booking });
};

// ── Admin: Completion notes ───────────────────────────────────────────────────

exports.updateCompletionNotes = async (req, res) => {
  const { completionNotes, adminNote } = req.body;
  const booking = await OnlineBooking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  if (completionNotes !== undefined) booking.completionNotes = completionNotes;
  if (adminNote !== undefined) booking.adminNote = adminNote;
  await booking.save();

  res.json({ success: true, message: 'Notes updated.', data: booking });
};

// ── Admin: Mark completed (without video) ─────────────────────────────────────

exports.adminMarkBookingCompleted = async (req, res) => {
  const booking = await OnlineBooking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  booking.status = 'completed';
  booking.completedAt = booking.completedAt || new Date();
  await booking.save();

  res.json({ success: true, message: 'Booking marked as completed.', data: booking });
};

// ── Pandit: List my assigned temple bookings ──────────────────────────────────

exports.getPanditAssignedBookings = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) {
    return res.status(404).json({ success: false, message: 'Pandit profile not found.' });
  }
  const { status } = req.query;
  const query = { panditId: pandit._id };
  if (status) query.status = status;

  // Pandits never see any monetary amount — booking amount or pooja price.
  const bookings = await OnlineBooking.find(query)
    .select('-amount')
    .populate('userId', 'name email phone')
    .populate('onlinePoojaId', 'name category templeLocation duration')
    .sort({ assignedAt: -1, createdAt: -1 });

  res.json({ success: true, data: bookings });
};

// ── Pandit: Mark started ──────────────────────────────────────────────────────

exports.panditStartBooking = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const booking = await OnlineBooking.findOne({
    _id: req.params.bookingId,
    panditId: pandit._id,
  });
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Assigned booking not found.' });
  }
  if (!['assigned', 'confirmed'].includes(booking.status)) {
    return res.status(400).json({ success: false, message: `Booking is in status "${booking.status}" — cannot start.` });
  }

  booking.status = 'in_progress';
  booking.startedAt = new Date();
  await booking.save();
  const data = booking.toObject();
  delete data.amount; // pandits never see the booking's rupee amount
  res.json({ success: true, message: 'Booking started.', data });
};

// ── Pandit: Mark completed (with optional note) ───────────────────────────────

exports.panditCompleteBooking = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const booking = await OnlineBooking.findOne({
    _id: req.params.bookingId,
    panditId: pandit._id,
  });
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Assigned booking not found.' });
  }
  if (!['assigned', 'in_progress', 'confirmed'].includes(booking.status)) {
    return res.status(400).json({ success: false, message: `Cannot complete a booking in status "${booking.status}".` });
  }

  if (typeof req.body.panditNote === 'string') {
    booking.panditNote = req.body.panditNote;
  }
  booking.status = 'completed';
  booking.completedAt = new Date();
  await booking.save();
  const data = booking.toObject();
  delete data.amount; // pandits never see the booking's rupee amount
  res.json({ success: true, message: 'Booking marked as completed.', data });
};
