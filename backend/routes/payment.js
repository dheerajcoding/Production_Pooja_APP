const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { createOrder, verifyPayment, getPaymentByBooking } = require('../controllers/paymentController');

router.post('/create-order', protect, authorize('user'), createOrder);
router.post('/verify', protect, authorize('user'), verifyPayment);
router.get('/:bookingId', protect, getPaymentByBooking);

module.exports = router;
