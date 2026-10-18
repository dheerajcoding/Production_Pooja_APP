const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Pandit = require('../models/Pandit');
const generateToken = require('../utils/generateToken');
const { sendEmail, passwordResetOtpTemplate } = require('../utils/email');
const { isEligibleForFreeAstroTrial } = require('./astroController');

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

exports.register = async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  const allowedRoles = ['user', 'pandit'];
  const userRole = allowedRoles.includes(role) ? role : 'user';

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered.' });
  }

  const user = await User.create({ name, email, password, phone, role: userRole });

  if (userRole === 'pandit') {
    await Pandit.create({ userId: user._id });
  }

  const token = generateToken({ id: user._id, role: user.role });

  res.status(201).json({
    success: true,
    message: 'Registration successful.',
    data: {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profilePhoto: user.profilePhoto,
        freeAstroTrialEligible: isEligibleForFreeAstroTrial(user),
      },
    },
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
  }

  const token = generateToken({ id: user._id, role: user.role });

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profilePhoto: user.profilePhoto,
        address: user.address,
        freeAstroTrialEligible: isEligibleForFreeAstroTrial(user),
      },
    },
  });
};

exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ success: false, message: 'idToken is required.' });
  }
  if (!process.env.GOOGLE_WEB_CLIENT_ID) {
    return res.status(500).json({ success: false, message: 'Google sign-in is not configured on the server.' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired Google token.' });
  }

  const { sub: googleId, email, name, picture } = payload;
  if (!email) {
    return res.status(400).json({ success: false, message: 'This Google account has no email.' });
  }

  let user = await User.findOne({ googleId });
  if (!user) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      // Existing password account with the same, Google-verified email — link it.
      user.googleId = googleId;
      if (!user.profilePhoto && picture) user.profilePhoto = picture;
      await user.save({ validateBeforeSave: false });
    } else {
      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        googleId,
        role: 'user',
        profilePhoto: picture || '',
      });
    }
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
  }

  const token = generateToken({ id: user._id, role: user.role });

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profilePhoto: user.profilePhoto,
        address: user.address,
        freeAstroTrialEligible: isEligibleForFreeAstroTrial(user),
      },
    },
  });
};

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  let panditProfile = null;
  if (user.role === 'pandit') {
    panditProfile = await Pandit.findOne({ userId: user._id });
  }
  res.json({ success: true, data: { user, panditProfile } });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.json({ success: true, message: 'If that email is registered, a reset code has been sent.' });
  }

  const otp = user.createPasswordResetOTP();
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      to: user.email,
      subject: 'Ritual Mitra - Password Reset Code',
      html: passwordResetOtpTemplate(user.name, otp),
    });
  } catch (err) {
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(500).json({ success: false, message: 'Email could not be sent.' });
  }

  res.json({ success: true, message: 'A 6-digit reset code has been sent to your email.' });
};

exports.resetPassword = async (req, res) => {
  const { email, otp, password } = req.body;
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  const user = await User.findOne({
    email,
    resetPasswordOTP: hashedOtp,
    resetPasswordOTPExpiry: { $gt: Date.now() },
  }).select('+resetPasswordOTP +resetPasswordOTPExpiry');

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
  }

  user.password = password;
  user.resetPasswordOTP = undefined;
  user.resetPasswordOTPExpiry = undefined;
  await user.save();

  const token = generateToken({ id: user._id, role: user.role });
  res.json({ success: true, message: 'Password reset successful.', data: { token } });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully.' });
};
