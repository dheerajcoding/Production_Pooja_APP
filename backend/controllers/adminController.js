const Razorpay = require('razorpay');
const User = require('../models/User');
const Pandit = require('../models/Pandit');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Pooja = require('../models/Pooja');

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ALLOWED_REFUND_PERCENTS = [100, 70, 50];

exports.getDashboardStats = async (req, res) => {
  const [
    usersCount,
    panditsCount,
    approvedPandits,
    bookingsCount,
    pendingBookings,
    completedBookings,
    revenueResult,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Pandit.countDocuments(),
    Pandit.countDocuments({ isApproved: true }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'completed' }),
    Payment.aggregate([{ $match: { status: 'captured' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = await Payment.aggregate([
    { $match: { status: 'captured', createdAt: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.json({
    success: true,
    data: {
      usersCount,
      panditsCount,
      approvedPandits,
      bookingsCount,
      pendingBookings,
      completedBookings,
      totalRevenue: revenueResult[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
    },
  });
};

exports.getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const query = {};
  if (role) query.role = role;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
    { phone: { $regex: search, $options: 'i' } },
  ];

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.toggleUserStatus = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot deactivate admin.' });

  user.isActive = !user.isActive;
  await user.save();

  res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, data: { isActive: user.isActive } });
};

exports.getAllPandits = async (req, res) => {
  const { page = 1, limit = 20, approved, search } = req.query;
  const query = {};
  if (approved !== undefined) query.isApproved = approved === 'true';

  let pandits = await Pandit.find(query)
    .populate('userId', 'name email phone isActive')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  if (search) {
    pandits = pandits.filter(
      (p) =>
        p.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.userId?.email?.toLowerCase().includes(search.toLowerCase())
    );
  }

  const total = await Pandit.countDocuments(query);

  res.json({
    success: true,
    data: {
      pandits,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.getPanditDetails = async (req, res) => {
  const pandit = await Pandit.findById(req.params.id)
    .populate('userId', 'name email phone address profilePhoto isActive');
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found.' });
  res.json({ success: true, data: pandit });
};

exports.approvePandit = async (req, res) => {
  const pandit = await Pandit.findById(req.params.id).populate('userId');
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found.' });

  pandit.isApproved = true;
  pandit.rejectionReason = '';
  await pandit.save();

  res.json({ success: true, message: 'Pandit approved.', data: pandit });
};

exports.rejectPandit = async (req, res) => {
  const pandit = await Pandit.findById(req.params.id);
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found.' });

  pandit.isApproved = false;
  pandit.rejectionReason = req.body.reason || 'Does not meet requirements.';
  await pandit.save();

  res.json({ success: true, message: 'Pandit rejected.', data: pandit });
};

exports.updatePandit = async (req, res) => {
  const pandit = await Pandit.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('userId', 'name email phone');
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found.' });
  res.json({ success: true, message: 'Pandit updated.', data: pandit });
};

exports.getAllBookings = async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const query = {};
  if (status) query.status = status;

  const bookings = await Booking.find(query)
    .populate('userId', 'name phone email')
    .populate('poojaId', 'name category price')
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name phone' } })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Booking.countDocuments(query);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.assignPandit = async (req, res) => {
  const { panditId } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  const pandit = await Pandit.findById(panditId);
  if (!pandit || !pandit.isApproved) {
    return res.status(400).json({ success: false, message: 'Invalid or unapproved pandit.' });
  }

  booking.panditId = panditId;
  booking.status = 'assigned';
  await booking.save();

  pandit.totalBookings += 1;
  await pandit.save();

  res.json({ success: true, message: 'Pandit assigned to booking.', data: booking });
};

exports.updateBookingStatus = async (req, res) => {
  const { status, cancellationReason } = req.body;
  const allowedStatuses = ['pending', 'assigned', 'confirmed', 'completed', 'cancelled', 'refund_processing', 'refunded'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  booking.status = status;
  if (status === 'cancelled' && cancellationReason) booking.cancellationReason = cancellationReason;
  if (status === 'completed') booking.completedAt = new Date();
  await booking.save();

  res.json({ success: true, message: 'Booking status updated.', data: booking });
};

// Admin-initiated refund — the user requests this by contacting customer
// support (phone/email), not through the app. Admin picks 100/70/50% and
// this calls Razorpay's Refunds API against the original payment.
exports.refundBooking = async (req, res) => {
  const percent = Number(req.body.percent);
  if (!ALLOWED_REFUND_PERCENTS.includes(percent)) {
    return res.status(400).json({ success: false, message: 'Refund percent must be 100, 70, or 50.' });
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (!booking.isPaid) {
    return res.status(400).json({ success: false, message: 'This booking was never paid.' });
  }
  if (booking.refund?.status === 'refunded') {
    return res.status(400).json({ success: false, message: 'This booking has already been refunded.' });
  }

  const payment = await Payment.findById(booking.paymentId);
  if (!payment || !payment.razorpayPaymentId) {
    return res.status(400).json({ success: false, message: 'No captured payment found for this booking.' });
  }

  const amountRupees = Math.round(booking.amount * percent) / 100;
  const amountPaise  = Math.round(amountRupees * 100);

  let refund;
  try {
    refund = await getRazorpay().payments.refund(payment.razorpayPaymentId, {
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
  // Reflect the refund in the booking's own status too, so the user sees
  // it on their booking's progress/status display — not just a background
  // field they'd never notice.
  booking.status = 'refunded';
  await booking.save();

  payment.status = 'refunded';
  await payment.save();

  res.json({
    success: true,
    message: `₹${amountRupees} (${percent}%) refunded successfully.`,
    data: booking,
  });
};
