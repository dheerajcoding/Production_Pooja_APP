const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadProfilePhoto } = require('../config/upload');
const { getProfile, updateProfile, getMyBookings } = require('../controllers/userController');

router.get('/profile', protect, authorize('user', 'admin'), getProfile);
router.put('/profile', protect, authorize('user', 'admin'), uploadProfilePhoto.single('profilePhoto'), updateProfile);
router.get('/bookings', protect, authorize('user'), getMyBookings);

module.exports = router;
