const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadPoojaImage, uploadPoojaVideo, uploadCompletionImages } = require('../config/upload');
const {
  getAllOnlinePoojas,
  getOnlinePoojaById,
  bookOnlinePooja,
  createOnlineBookingPayment,
  verifyOnlineBookingPayment,
  getMyOnlineBookings,
  createOnlinePooja,
  updateOnlinePooja,
  deleteOnlinePooja,
  getAllOnlineBookingsAdmin,
  updateBookingStatus,
  uploadVideoToBooking,
  assignPanditToBooking,
  uploadCompletionImagesToBooking,
  updateCompletionNotes,
  adminMarkBookingCompleted,
  getPanditAssignedBookings,
  panditStartBooking,
  panditCompleteBooking,
} = require('../controllers/onlinePoojaController');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', getAllOnlinePoojas);
router.get('/:id', getOnlinePoojaById);

// ── User ──────────────────────────────────────────────────────────────────────
router.post('/:id/book',               protect, authorize('user'), bookOnlinePooja);
router.post('/booking/payment/create', protect, authorize('user'), createOnlineBookingPayment);
router.post('/booking/payment/verify', protect, authorize('user'), verifyOnlineBookingPayment);
router.get('/my/bookings',             protect, authorize('user'), getMyOnlineBookings);

// ── Admin: Pooja management ───────────────────────────────────────────────────
router.post('/',    protect, authorize('admin'), uploadPoojaImage.single('image'), createOnlinePooja);
router.put('/:id',  protect, authorize('admin'), uploadPoojaImage.single('image'), updateOnlinePooja);
router.delete('/:id', protect, authorize('admin'), deleteOnlinePooja);

// ── Admin: Booking management ─────────────────────────────────────────────────
router.get('/admin/bookings',                          protect, authorize('admin'), getAllOnlineBookingsAdmin);
router.put('/admin/bookings/:bookingId/status',        protect, authorize('admin'), updateBookingStatus);
router.put('/admin/bookings/:bookingId/assign-pandit', protect, authorize('admin'), assignPanditToBooking);
router.put('/admin/bookings/:bookingId/notes',         protect, authorize('admin'), updateCompletionNotes);
router.put('/admin/bookings/:bookingId/mark-completed',protect, authorize('admin'), adminMarkBookingCompleted);
// Video upload: supports multipart (file) or JSON (external URL)
router.put('/admin/bookings/:bookingId/upload-video',  protect, authorize('admin'),
  uploadPoojaVideo.single('video'), uploadVideoToBooking);
// Multiple images upload
router.put('/admin/bookings/:bookingId/upload-images', protect, authorize('admin'),
  uploadCompletionImages.array('images', 10), uploadCompletionImagesToBooking);

// ── Pandit: Assigned temple bookings ──────────────────────────────────────────
router.get('/pandit/bookings',                          protect, authorize('pandit'), getPanditAssignedBookings);
router.put('/pandit/bookings/:bookingId/start',         protect, authorize('pandit'), panditStartBooking);
router.put('/pandit/bookings/:bookingId/complete',      protect, authorize('pandit'), panditCompleteBooking);

module.exports = router;
