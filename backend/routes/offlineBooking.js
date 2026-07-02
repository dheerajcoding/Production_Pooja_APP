const express = require('express');
const router  = express.Router();
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const ctrl = require('../controllers/offlineBookingController');

// Public — browse pandits with fees
router.get('/pandits', ctrl.getAvailablePandits);

// User
router.post('/',              protect, authorize('user'),   ctrl.createBooking);
router.get('/my',             protect, authorize('user'),   ctrl.getMyOfflineBookings);
router.put('/:id/cancel',     protect, authorize('user'),   ctrl.cancelOfflineBooking);
router.post('/:id/pay/create', protect, authorize('user'),  ctrl.createPayment);
router.post('/:id/pay/verify', protect, authorize('user'),  ctrl.verifyPayment);

// Pandit — view requests, accept/reject, mark complete
router.get('/pandit/bookings',       protect, authorize('pandit'), ctrl.getPanditBookings);
router.put('/pandit/:id/accept',     protect, authorize('pandit'), ctrl.acceptRequest);
router.put('/pandit/:id/reject',     protect, authorize('pandit'), ctrl.rejectRequest);
router.put('/pandit/:id/complete',   protect, authorize('pandit'), ctrl.markOfflineComplete);

// Admin
router.get('/admin/all',         protect, authorize('admin'), ctrl.getAllOfflineBookings);
router.put('/admin/:id/status',  protect, authorize('admin'), ctrl.adminUpdateOfflineStatus);

module.exports = router;
