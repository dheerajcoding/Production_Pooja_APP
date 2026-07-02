const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const {
  getDashboardStats, getAllUsers, toggleUserStatus,
  getAllPandits, approvePandit, rejectPandit, updatePandit,
  getAllBookings, assignPandit, updateBookingStatus,
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.get('/pandits', getAllPandits);
router.put('/pandits/:id/approve', approvePandit);
router.put('/pandits/:id/reject', rejectPandit);
router.put('/pandits/:id', updatePandit);
router.get('/bookings', getAllBookings);
router.put('/bookings/:id/assign', assignPandit);
router.put('/bookings/:id/status', updateBookingStatus);

module.exports = router;
