const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadProfilePhoto } = require('../config/upload');
const {
  getAllPandits, getPanditById, getMyProfile, updateMyProfile,
  toggleAvailability, getMyBookings, acceptBooking, rejectBooking,
  completeBooking, getEarningsSummary,
} = require('../controllers/panditController');

router.get('/', getAllPandits);
router.get('/profile', protect, authorize('pandit'), getMyProfile);
router.put('/profile', protect, authorize('pandit'), uploadProfilePhoto.single('photo'), updateMyProfile);
router.put('/availability', protect, authorize('pandit'), toggleAvailability);
router.get('/bookings', protect, authorize('pandit'), getMyBookings);
router.put('/bookings/:id/accept', protect, authorize('pandit'), acceptBooking);
router.put('/bookings/:id/reject', protect, authorize('pandit'), rejectBooking);
router.put('/bookings/:id/complete', protect, authorize('pandit'), completeBooking);
router.get('/earnings', protect, authorize('pandit'), getEarningsSummary);
router.get('/:id', getPanditById);

module.exports = router;
