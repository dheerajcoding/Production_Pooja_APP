const fs = require('fs');
const path = require('path');
const Pandit = require('../models/Pandit');
const Booking = require('../models/Booking');
const User = require('../models/User');

const getFileUrl = (req, filename) => {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/profiles/${path.basename(filename)}`;
};

const deleteOldFile = (filename) => {
  if (filename) {
    const fullPath = path.join(__dirname, '../uploads/profiles', path.basename(filename));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
};

exports.getAllPandits = async (req, res) => {
  const { page = 1, limit = 12, expertise, available } = req.query;
  const query = { isApproved: true };
  if (expertise) query.expertise = { $in: [expertise] };
  if (available !== undefined) query.isAvailable = available === 'true';

  const pandits = await Pandit.find(query)
    .populate('userId', 'name profilePhoto')
    .sort({ rating: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Pandit.countDocuments(query);

  res.json({
    success: true,
    data: {
      pandits,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.getPanditById = async (req, res) => {
  const pandit = await Pandit.findById(req.params.id).populate('userId', 'name profilePhoto');
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found.' });
  res.json({ success: true, data: pandit });
};

exports.getMyProfile = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id }).populate('userId', 'name email phone profilePhoto address');
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  // Backfill: existing pandits who uploaded via /pandits/profile before the
  // mirror was added have pandit.photo set but user.profilePhoto blank. Sync
  // once so every user-facing screen (browse, bookings, admin, notifications)
  // sees their photo through either field.
  if (pandit.photo && (!pandit.userId?.profilePhoto || pandit.userId.profilePhoto !== pandit.photo)) {
    await User.findByIdAndUpdate(pandit.userId._id || pandit.userId, { profilePhoto: pandit.photo });
    if (pandit.userId) pandit.userId.profilePhoto = pandit.photo;
  }

  res.json({ success: true, data: pandit });
};

exports.updateMyProfile = async (req, res) => {
  const {
    bio, experience, languages, expertise, location,
    aadhaarNumber, panNumber, education, operationalCity, basicDakshinaRate,
    currentAddress, bankDetails, declarationAccepted,
  } = req.body;
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  // Existing fields
  if (bio !== undefined) pandit.bio = bio;
  if (experience !== undefined) pandit.experience = experience;
  if (languages !== undefined) pandit.languages = Array.isArray(languages) ? languages : languages.split(',').map((l) => l.trim());
  if (expertise !== undefined) pandit.expertise = Array.isArray(expertise) ? expertise : expertise.split(',').map((e) => e.trim());
  if (location !== undefined) pandit.location = location;

  // Identity verification (light validation — full KYC verification is admin-side)
  if (aadhaarNumber !== undefined) {
    const clean = String(aadhaarNumber).replace(/\s/g, '');
    if (clean && !/^\d{12}$/.test(clean)) {
      return res.status(400).json({ success: false, message: 'Aadhaar must be exactly 12 digits.' });
    }
    pandit.aadhaarNumber = clean;
  }
  if (panNumber !== undefined) {
    const clean = String(panNumber).toUpperCase().trim();
    if (clean && !/^[A-Z]{5}\d{4}[A-Z]$/.test(clean)) {
      return res.status(400).json({ success: false, message: 'PAN must match format AAAAA9999A.' });
    }
    pandit.panNumber = clean;
  }

  // Professional / service
  if (education !== undefined)         pandit.education = education;
  if (operationalCity !== undefined)   pandit.operationalCity = operationalCity;
  if (basicDakshinaRate !== undefined) pandit.basicDakshinaRate = Number(basicDakshinaRate) || 0;

  // Address (multipart FormData delivers nested objects as JSON strings)
  let addrObj = currentAddress;
  if (typeof addrObj === 'string') {
    try { addrObj = JSON.parse(addrObj); } catch { addrObj = null; }
  }
  if (addrObj && typeof addrObj === 'object') {
    pandit.currentAddress = { ...(pandit.currentAddress?.toObject?.() || pandit.currentAddress || {}), ...addrObj };
  }

  // Bank details for settlements
  let bankObj = bankDetails;
  if (typeof bankObj === 'string') {
    try { bankObj = JSON.parse(bankObj); } catch { bankObj = null; }
  }
  if (bankObj && typeof bankObj === 'object') {
    const merged = { ...(pandit.bankDetails?.toObject?.() || pandit.bankDetails || {}), ...bankObj };
    if (merged.ifscCode) {
      const ifsc = String(merged.ifscCode).toUpperCase().trim();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        return res.status(400).json({ success: false, message: 'IFSC code format is invalid.' });
      }
      merged.ifscCode = ifsc;
    }
    pandit.bankDetails = merged;
  }

  // Declaration checkbox — record timestamp on first true
  if (declarationAccepted !== undefined) {
    const accepted = Boolean(declarationAccepted);
    if (accepted && !pandit.declarationAccepted) pandit.declarationAcceptedAt = new Date();
    pandit.declarationAccepted = accepted;
  }

  if (req.file) {
    deleteOldFile(pandit.photoPublicId);
    pandit.photo = getFileUrl(req, req.file.filename);
    pandit.photoPublicId = req.file.filename;
  }

  await pandit.save();

  const user = await User.findById(req.user._id);
  const { name, phone } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  // Mirror the pandit's photo onto the User doc so every user-facing screen
  // that reads userId.profilePhoto (browsing pandits, booking cards, admin
  // lists, notifications) sees the same image the pandit uploaded.
  if (req.file) user.profilePhoto = pandit.photo;
  await user.save();

  res.json({ success: true, message: 'Profile updated.', data: pandit });
};

exports.toggleAvailability = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  pandit.isAvailable = !pandit.isAvailable;
  await pandit.save();

  res.json({
    success: true,
    message: `You are now ${pandit.isAvailable ? 'available' : 'unavailable'}.`,
    data: { isAvailable: pandit.isAvailable },
  });
};

exports.getMyBookings = async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const query = { panditId: pandit._id };
  if (status) query.status = status;

  const bookings = await Booking.find(query)
    .populate('poojaId', 'name image category price duration')
    .populate('userId', 'name phone address')
    .sort({ bookingDate: 1 })
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

exports.acceptBooking = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  const booking = await Booking.findOne({ _id: req.params.id, panditId: pandit._id, status: 'assigned' });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you.' });

  booking.status = 'confirmed';
  await booking.save();
  res.json({ success: true, message: 'Booking accepted.', data: booking });
};

exports.rejectBooking = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  const booking = await Booking.findOne({ _id: req.params.id, panditId: pandit._id, status: 'assigned' });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  booking.status = 'pending';
  booking.panditId = undefined;
  booking.panditNotes = req.body.reason || '';
  await booking.save();
  res.json({ success: true, message: 'Booking rejected. Admin will reassign.', data: booking });
};

exports.completeBooking = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  const booking = await Booking.findOne({ _id: req.params.id, panditId: pandit._id, status: 'confirmed' });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  booking.status = 'completed';
  booking.completedAt = new Date();
  await booking.save();

  pandit.completedBookings += 1;
  pandit.earnings += booking.amount * 0.8;
  await pandit.save();

  res.json({ success: true, message: 'Booking marked as completed.', data: booking });
};

exports.getEarningsSummary = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyEarnings = await Booking.aggregate([
    { $match: { panditId: pandit._id, status: 'completed', completedAt: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: { $multiply: ['$amount', 0.8] } }, count: { $sum: 1 } } },
  ]);

  res.json({
    success: true,
    data: {
      totalEarnings: pandit.earnings,
      totalBookings: pandit.totalBookings,
      completedBookings: pandit.completedBookings,
      monthlyEarnings: monthlyEarnings[0]?.total || 0,
      monthlyBookings: monthlyEarnings[0]?.count || 0,
    },
  });
};
