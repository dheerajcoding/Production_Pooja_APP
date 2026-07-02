const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

// Lazy init — created per request so env vars are always fresh
const getRazorpay = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

exports.createOrder = async (req, res) => {
  const { bookingId } = req.body;

  const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  if (booking.isPaid) {
    return res.status(400).json({ success: false, message: 'Booking is already paid.' });
  }

  const razorpay = getRazorpay();

  const options = {
    amount: Math.round(booking.amount * 100),
    currency: 'INR',
    receipt: `booking_${bookingId}`,
    notes: {
      bookingId: bookingId.toString(),
      userId: req.user._id.toString(),
    },
  };

  const order = await razorpay.orders.create(options);

  const payment = await Payment.create({
    bookingId,
    userId: req.user._id,
    razorpayOrderId: order.id,
    amount: booking.amount,
  });

  res.json({
    success: true,
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id,
    },
  });
};

exports.verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
  }

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  payment.status = 'captured';
  await payment.save();

  const booking = await Booking.findById(bookingId);
  if (booking) {
    booking.isPaid = true;
    booking.paymentId = payment._id;
    await booking.save();
  }

  res.json({ success: true, message: 'Payment verified successfully.', data: { payment, booking } });
};

exports.getPaymentByBooking = async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, userId: req.user._id });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  const payment = await Payment.findOne({ bookingId: req.params.bookingId });
  res.json({ success: true, data: payment });
};
