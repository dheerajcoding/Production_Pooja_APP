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
