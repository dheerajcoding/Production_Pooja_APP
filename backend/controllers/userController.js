const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Booking = require('../models/Booking');

// Build public URL for uploaded file
const getFileUrl = (req, filePath) => {
  if (!filePath) return '';
  const filename = path.basename(filePath);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/profiles/${filename}`;
};

// Delete old file from disk
const deleteOldFile = (filePath) => {
  if (filePath) {
    const fullPath = path.join(__dirname, '../uploads/profiles', path.basename(filePath));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
};

exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: user });
};

exports.updateProfile = async (req, res) => {
  const { name, phone, address } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = { ...user.address, ...address };

  if (req.file) {
    // Delete old photo from disk
    deleteOldFile(user.profilePhotoPublicId);
    user.profilePhoto = getFileUrl(req, req.file.filename);
    user.profilePhotoPublicId = req.file.filename;
  }

  await user.save();
  res.json({ success: true, message: 'Profile updated successfully.', data: user });
};

exports.getMyBookings = async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = { userId: req.user._id };
  if (status) query.status = status;

  const bookings = await Booking.find(query)
    .populate('poojaId', 'name image category price')
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name phone' } })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Booking.countDocuments(query);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

// Public web form deletion request (Google Play Data Safety compliant)
exports.requestAccountDeletion = async (req, res) => {
  const { name, email, phone, reason } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  const DeletionRequest = require('../models/DeletionRequest');

  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  const deletionReq = await DeletionRequest.create({
    name: name || '',
    email: email.toLowerCase().trim(),
    phone: phone || '',
    reason: reason || '',
    source: 'web_form',
    ipAddress: typeof ipAddress === 'string' ? ipAddress : '',
    status: 'pending',
  });

  res.json({
    success: true,
    message: 'Your account deletion request has been submitted successfully. In accordance with our policy, your account and personal data will be processed and removed within 30 days.',
    data: { id: deletionReq._id, email: deletionReq.email },
  });
};

// In-app user account deletion (Authenticated)
exports.deleteMyAccount = async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  // Prevent accidental admin account deletion
  if (user.role === 'admin') {
    return res.status(403).json({ success: false, message: 'Admin account cannot be deleted via app.' });
  }

  // 1. Delete profile photo from disk if present
  deleteOldFile(user.profilePhotoPublicId);

  // 2. Clean up user's active cart
  try {
    const Cart = require('../models/Cart');
    await Cart.deleteMany({ userId });
  } catch (err) {
    console.warn('Cart cleanup warning:', err.message);
  }

  // 3. Log deletion request as completed
  try {
    const DeletionRequest = require('../models/DeletionRequest');
    await DeletionRequest.create({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      reason: req.body?.reason || 'User requested deletion via mobile app',
      source: 'in_app',
      status: 'completed',
      processedAt: new Date(),
    });
  } catch (err) {
    console.warn('DeletionRequest log warning:', err.message);
  }

  // 4. Delete user record
  await User.findByIdAndDelete(userId);

  res.json({
    success: true,
    message: 'Your account and associated personal data have been permanently deleted.',
  });
};

