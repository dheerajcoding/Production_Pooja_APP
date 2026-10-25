const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const {
  getDashboardStats, getAllUsers, toggleUserStatus,
  getAllPandits, getPanditDetails, approvePandit, rejectPandit, updatePandit,
  getAllBookings, assignPandit, updateBookingStatus, refundBooking,
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.get('/pandits', getAllPandits);
router.get('/pandits/:id', getPanditDetails);
router.put('/pandits/:id/approve', approvePandit);
router.put('/pandits/:id/reject', rejectPandit);
router.put('/pandits/:id', updatePandit);
router.get('/bookings', getAllBookings);
router.put('/bookings/:id/assign', assignPandit);
router.put('/bookings/:id/status', updateBookingStatus);
router.put('/bookings/:id/refund', refundBooking);

module.exports = router;
