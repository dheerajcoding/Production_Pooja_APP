const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const validate = require('../middleware/validate');
const { createBooking, getBookingById, cancelBooking } = require('../controllers/bookingController');

router.post('/', protect, authorize('user'), [
  body('poojaId').notEmpty().withMessage('Pooja is required'),
  body('bookingDate').isISO8601().withMessage('Valid booking date is required'),
  body('bookingTime').notEmpty().withMessage('Booking time is required'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.pincode').notEmpty().withMessage('Pincode is required'),
], validate, createBooking);

router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, authorize('user'), cancelBooking);

module.exports = router;
