const Booking = require('../models/Booking');
const Pooja = require('../models/Pooja');
const { sendEmail, bookingConfirmTemplate } = require('../utils/email');
const User = require('../models/User');

exports.createBooking = async (req, res) => {
  const { poojaId, bookingDate, bookingTime, address, specialRequirements } = req.body;

  const pooja = await Pooja.findById(poojaId);
  if (!pooja || !pooja.isActive) {
    return res.status(404).json({ success: false, message: 'Pooja not found or unavailable.' });
  }

  const date = new Date(bookingDate);
  if (date < new Date()) {
    return res.status(400).json({ success: false, message: 'Booking date must be in the future.' });
  }

  const booking = await Booking.create({
    userId: req.user._id,
    poojaId,
    bookingDate: date,
    bookingTime,
    address,
    specialRequirements,
    amount: pooja.price,
  });

  pooja.bookingCount += 1;
  await pooja.save();

  const user = await User.findById(req.user._id);
  try {
    await sendEmail({
      to: user.email,
      subject: 'Saral Pooja - Booking Received',
      html: bookingConfirmTemplate(user.name, booking),
    });
  } catch (_) {}

  res.status(201).json({ success: true, message: 'Booking created. Please complete payment.', data: booking });
};

exports.getBookingById = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('poojaId', 'name image category price duration')
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name phone' } })
    .populate('userId', 'name phone email');

  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  const isOwner = booking.userId._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  res.json({ success: true, data: booking });
};

exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  if (['completed', 'cancelled'].includes(booking.status)) {
    return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.status} booking.` });
  }

  booking.status = 'cancelled';
  booking.cancellationReason = req.body.reason || 'Cancelled by user.';
  await booking.save();

  res.json({ success: true, message: 'Booking cancelled.', data: booking });
};
