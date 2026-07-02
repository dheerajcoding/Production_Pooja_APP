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
  const { page = 1, limit = 9, category } = req.query;
  const query = { isActive: true };
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
  const { preferredDate, gotraName, wishes, memberNames } = req.body;

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

  const booking = await OnlineBooking.findById(bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

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
    .populate({ path: 'panditId', select: 'name photo experience' })
    .sort({ createdAt: -1 });

  res.json({ success: true, data: bookings });
};

// ── Admin: Manage Special Poojas ──────────────────────────────────────────────

exports.createOnlinePooja = async (req, res) => {
  const {
    name, description, category, price, duration, language,
    panditName, templeLocation, deliveryDays, includedItems,
  } = req.body;

  const data = {
    name, description, category,
    price: parseFloat(price),
    duration,
    language,
    panditName,
    templeLocation,
    deliveryDays: parseInt(deliveryDays) || 3,
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
    .populate('onlinePoojaId', 'name category price templeName templeAddress')
    .populate({ path: 'panditId', select: 'name photo' })
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
    .populate('onlinePoojaId', 'name category price templeName templeAddress')
    .populate({ path: 'panditId', select: 'name photo experience' });

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

  const bookings = await OnlineBooking.find(query)
    .populate('userId', 'name email phone')
    .populate('onlinePoojaId', 'name category price templeName templeAddress duration')
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
  res.json({ success: true, message: 'Booking started.', data: booking });
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
  res.json({ success: true, message: 'Booking marked as completed.', data: booking });
};
