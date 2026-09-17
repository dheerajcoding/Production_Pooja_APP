const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadProfilePhoto } = require('../config/upload');
const { getProfile, updateProfile, getMyBookings, requestAccountDeletion, deleteMyAccount } = require('../controllers/userController');

// Public web-based account deletion request (Google Play Data Safety)
router.post('/request-deletion', requestAccountDeletion);

router.get('/profile', protect, authorize('user', 'admin'), getProfile);
router.put('/profile', protect, authorize('user', 'admin'), uploadProfilePhoto.single('profilePhoto'), updateProfile);
router.delete('/profile', protect, authorize('user', 'pandit'), deleteMyAccount);
router.delete('/delete-account', protect, authorize('user', 'pandit'), deleteMyAccount);
router.get('/bookings', protect, authorize('user'), getMyBookings);

module.exports = router;

