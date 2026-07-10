const Pandit             = require('../models/Pandit');
const AstroSession       = require('../models/AstroSession');
const User               = require('../models/User');
const WalletTransaction  = require('../models/WalletTransaction');

const BLOCK_MINUTES = 10; // legacy field kept for backward compatibility on schema

/* ─────────────────────────────────────────────
   PUBLIC — list astrologers (live + offline)
───────────────────────────────────────────── */
exports.getLiveAstrologers = async (req, res) => {
  const pandits = await Pandit.find({ isAstrologer: true, isApproved: true })
    .populate('userId', 'name profilePhoto')
    .select('userId photo bio experience languages expertise astroRate isLiveNow rating totalRatings');

  res.json({
    success: true,
    data: pandits.map((p) => ({
      _id:          p._id,
      name:         p.userId?.name,
      photo:        p.photo || p.userId?.profilePhoto || '',
      bio:          p.bio,
      experience:   p.experience,
      languages:    p.languages,
      expertise:    p.expertise,
      astroRate:    p.astroRate,
      isLiveNow:    p.isLiveNow,
      rating:       p.averageRating,
      totalRatings: p.totalRatings,
    })),
  });
};

/* ─────────────────────────────────────────────
   USER — request a chat session
───────────────────────────────────────────── */
exports.requestSession = async (req, res) => {
  const { panditId } = req.body;

  const pandit = await Pandit.findById(panditId);
  if (!pandit)           return res.status(404).json({ success: false, message: 'Pandit not found.' });
  if (!pandit.isAstrologer) return res.status(400).json({ success: false, message: 'This pandit does not offer astrology chat.' });
  if (!pandit.isApproved)   return res.status(400).json({ success: false, message: 'Pandit is not approved.' });
  if (!pandit.isLiveNow)    return res.status(400).json({ success: false, message: 'Pandit is currently offline.' });

  // User must not already have an open session
  const existingUser = await AstroSession.findOne({
    userId: req.user._id,
    status: { $in: ['waiting', 'accepted', 'active', 'expired'] },
  });
  if (existingUser) return res.status(400).json({ success: false, message: 'You already have an open session. Please end it first.' });

  // Pandit must not already have an open session
  const existingPandit = await AstroSession.findOne({
    panditId,
    status: { $in: ['waiting', 'accepted', 'active', 'expired'] },
  });
  if (existingPandit) return res.status(400).json({ success: false, message: 'Pandit is busy right now. Please try again shortly.' });

  const session = await AstroSession.create({
    panditId,
    userId:        req.user._id,
    ratePerMinute: pandit.astroRate,
    blockMinutes:  BLOCK_MINUTES,
    status:        'waiting',
  });

  await session.populate([
    { path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo astroRate' },
    { path: 'userId',   select: 'name' },
  ]);

  res.status(201).json({ success: true, data: session, message: 'Request sent! Waiting for pandit to accept.' });
};

/* ─────────────────────────────────────────────
   USER — get my open session (waiting/accepted/active/expired)
───────────────────────────────────────────── */
exports.getMyActiveSession = async (req, res) => {
  const session = await AstroSession.findOne({
    userId: req.user._id,
    status: { $in: ['waiting', 'accepted', 'active', 'expired'] },
  })
    .sort({ createdAt: -1 })
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo astroRate' })
    .populate('userId', 'name');

  // Auto-expire on rejoin — if paidUntil has passed, mark expired so user sees recharge screen
  if (session && session.status === 'active' && session.paidUntil && new Date() > new Date(session.paidUntil)) {
    session.status = 'expired';
    await session.save();
  }

  res.json({ success: true, data: session || null });
};

/* ─────────────────────────────────────────────
   USER — get session by ID
───────────────────────────────────────────── */
exports.getSessionById = async (req, res) => {
  const session = await AstroSession.findById(req.params.id)
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo astroRate' })
    .populate('userId', 'name');

  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  res.json({ success: true, data: session });
};

/* ─────────────────────────────────────────────
   USER — start / resume chat from wallet
   Reserves the maximum whole minutes the user's
   wallet can afford at the current per-minute rate,
   deducts that amount, sets paidUntil accordingly.
───────────────────────────────────────────── */
exports.startChatFromWallet = async (req, res) => {
  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Access denied.' });

  const allowedStatuses = ['accepted', 'expired'];
  if (!allowedStatuses.includes(session.status)) {
    return res.status(400).json({ success: false, message: `Cannot start chat for a session with status: ${session.status}.` });
  }

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const balance      = user.walletBalance || 0;
  const rate         = session.ratePerMinute;
  const affordable   = Math.floor(balance / rate);

  if (affordable < 1) {
    return res.status(400).json({
      success:            false,
      message:            'Insufficient wallet balance. Please top up your wallet to continue.',
      code:               'INSUFFICIENT_BALANCE',
      walletBalance:      balance,
      ratePerMinute:      rate,
      minimumRequired:    rate,
    });
  }

  const now          = new Date();
  const deductAmount = affordable * rate;

  user.walletBalance = balance - deductAmount;
  await user.save();

  session.status           = 'active';
  session.paidUntil        = new Date(now.getTime() + affordable * 60 * 1000);
  session.totalPaidMinutes = (session.totalPaidMinutes || 0) + affordable;
  session.totalPaidAmount  = (session.totalPaidAmount  || 0) + deductAmount;
  if (!session.startTime) session.startTime = now;

  await session.save();

  await WalletTransaction.create({
    userId:        user._id,
    type:          'debit',
    amount:        deductAmount,
    balanceAfter:  user.walletBalance,
    referenceType: 'astro_session',
    referenceId:   session._id,
    description:   `Astrology chat — ${affordable} min reserved @ ₹${rate}/min`,
  });

  await session.populate([
    { path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo astroRate' },
    { path: 'userId', select: 'name' },
  ]);

  res.json({
    success: true,
    data: {
      session,
      walletBalance:    user.walletBalance,
      minutesReserved:  affordable,
      amountDeducted:   deductAmount,
    },
    message: `Chat started! ${affordable} minute${affordable === 1 ? '' : 's'} reserved from your wallet.`,
  });
};

/* ─────────────────────────────────────────────
   USER — cancel waiting request
───────────────────────────────────────────── */
exports.cancelRequest = async (req, res) => {
  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Access denied.' });
  if (session.status !== 'waiting') return res.status(400).json({ success: false, message: 'Can only cancel a waiting request.' });

  session.status  = 'cancelled';
  session.endTime = new Date();
  await session.save();

  res.json({ success: true, message: 'Request cancelled.' });
};

/* ─────────────────────────────────────────────
   SHARED (user + pandit) — send a text message
───────────────────────────────────────────── */
exports.sendMessage = async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

  const session = await AstroSession.findById(req.params.id);
  if (!session)                    return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Chat is not active. Please start the chat from your wallet.' });

  // Auto-expire if paidUntil has passed
  if (session.paidUntil && new Date() > new Date(session.paidUntil)) {
    session.status = 'expired';
    await session.save();
    return res.status(400).json({ success: false, message: 'Your reserved minutes are up. Please top up your wallet and resume to continue.' });
  }

  const senderRole = req.user.role === 'user' ? 'user' : 'pandit';
  session.messages.push({ senderId: req.user._id, senderRole, messageType: 'text', text: text.trim() });
  await session.save();

  const newMsg = session.messages[session.messages.length - 1];
  res.json({ success: true, data: newMsg });
};

/* ─────────────────────────────────────────────
   SHARED (user + pandit) — send an image message
───────────────────────────────────────────── */
exports.sendImageMessage = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided.' });

  const session = await AstroSession.findById(req.params.id);
  if (!session)                    return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Chat is not active. Please start the chat from your wallet.' });

  // Auto-expire check
  if (session.paidUntil && new Date() > new Date(session.paidUntil)) {
    session.status = 'expired';
    await session.save();
    return res.status(400).json({ success: false, message: 'Your reserved minutes are up. Please top up your wallet and resume to continue.' });
  }

  const senderRole = req.user.role === 'user' ? 'user' : 'pandit';
  const imageUrl   = `/uploads/chat/${req.file.filename}`;
  const caption    = req.body.caption?.trim() || '';

  session.messages.push({
    senderId:    req.user._id,
    senderRole,
    messageType: 'image',
    text:        caption,
    imageUrl,
  });
  await session.save();

  const newMsg = session.messages[session.messages.length - 1];
  res.json({ success: true, data: newMsg });
};

/* ─────────────────────────────────────────────
   SHARED — poll messages + session status
───────────────────────────────────────────── */
exports.getMessages = async (req, res) => {
  const session = await AstroSession.findById(req.params.id)
    .select('messages status startTime paidUntil ratePerMinute totalPaidMinutes totalPaidAmount blockMinutes');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  // Auto-expire check
  let expired = false;
  if (session.status === 'active' && session.paidUntil && new Date() > new Date(session.paidUntil)) {
    session.status = 'expired';
    await session.save();
    expired = true;
  }

  const since = req.query.since ? new Date(req.query.since) : null;
  const messages = since
    ? session.messages.filter((m) => new Date(m.createdAt) > since)
    : session.messages;

  res.json({
    success: true,
    data: {
      messages,
      status:           session.status,
      paidUntil:        session.paidUntil,
      startTime:        session.startTime,
      ratePerMinute:    session.ratePerMinute,
      blockMinutes:     session.blockMinutes,
      totalPaidMinutes: session.totalPaidMinutes,
      totalPaidAmount:  session.totalPaidAmount,
      justExpired:      expired,
    },
  });
};

/* ─────────────────────────────────────────────
   SHARED (user + pandit) — end session
───────────────────────────────────────────── */
exports.endSession = async (req, res) => {
  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  if (!['waiting', 'accepted', 'active', 'expired'].includes(session.status)) {
    return res.status(400).json({ success: false, message: 'Session is already ended.' });
  }

  const now = new Date();

  // Refund unused reserved minutes back to the user's wallet.
  // Only applies when the session was active with paidUntil in the future.
  let refundAmount   = 0;
  let refundMinutes  = 0;
  let newBalance     = null;

  if (session.status === 'active' && session.paidUntil && new Date(session.paidUntil) > now) {
    const remainingMs = new Date(session.paidUntil).getTime() - now.getTime();
    refundMinutes = Math.floor(remainingMs / 60000); // whole unused minutes only
    if (refundMinutes > 0) {
      refundAmount = refundMinutes * (session.ratePerMinute || 0);
    }
  }

  session.status  = 'ended';
  session.endTime = now;
  session.endedBy = req.user.role === 'admin' ? 'admin' : req.user.role;

  if (refundAmount > 0) {
    session.totalPaidMinutes = Math.max(0, (session.totalPaidMinutes || 0) - refundMinutes);
    session.totalPaidAmount  = Math.max(0, (session.totalPaidAmount  || 0) - refundAmount);

    // Credit user's wallet — refund goes to the session's user, not the actor
    // (endedBy could be pandit/admin, but the money belongs to the user).
    const user = await User.findById(session.userId);
    if (user) {
      user.walletBalance = (user.walletBalance || 0) + refundAmount;
      await user.save();
      newBalance = user.walletBalance;

      await WalletTransaction.create({
        userId:        user._id,
        type:          'refund',
        amount:        refundAmount,
        balanceAfter:  user.walletBalance,
        referenceType: 'astro_session',
        referenceId:   session._id,
        description:   `Refund — ${refundMinutes} unused min from ended session`,
      });
    }
  }

  await session.save();

  res.json({
    success: true,
    data: session,
    refund: refundAmount > 0
      ? { minutes: refundMinutes, amount: refundAmount, walletBalance: newBalance }
      : null,
    message: refundAmount > 0
      ? `Session ended. ₹${refundAmount} refunded to wallet for ${refundMinutes} unused minute${refundMinutes === 1 ? '' : 's'}.`
      : 'Session ended.',
  });
};

/* ─────────────────────────────────────────────
   USER — session history
───────────────────────────────────────────── */
exports.getMySessionHistory = async (req, res) => {
  const sessions = await AstroSession.find({ userId: req.user._id, status: { $in: ['ended', 'cancelled', 'rejected'] } })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({ path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo' })
    .select('-messages');

  res.json({ success: true, data: sessions });
};

/* ─────────────────────────────────────────────
   PANDIT — toggle live status
───────────────────────────────────────────── */
exports.toggleLive = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit)             return res.status(404).json({ success: false, message: 'Pandit profile not found.' });
  if (!pandit.isAstrologer) return res.status(403).json({ success: false, message: 'Astrology not enabled for your account. Contact admin.' });

  if (pandit.isLiveNow) {
    const busy = await AstroSession.findOne({ panditId: pandit._id, status: { $in: ['active', 'accepted'] } });
    if (busy) return res.status(400).json({ success: false, message: 'Please end your current session before going offline.' });
  }

  pandit.isLiveNow = !pandit.isLiveNow;
  await pandit.save();

  res.json({
    success: true,
    data:    { isLiveNow: pandit.isLiveNow },
    message: pandit.isLiveNow ? '🟢 You are now LIVE!' : '🔴 You are now Offline.',
  });
};

/* ─────────────────────────────────────────────
   PANDIT — incoming requests
───────────────────────────────────────────── */
exports.getIncomingRequests = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const sessions = await AstroSession.find({ panditId: pandit._id, status: 'waiting' })
    .sort({ createdAt: 1 })
    .populate('userId', 'name profilePhoto');

  res.json({ success: true, data: sessions });
};

/* ─────────────────────────────────────────────
   PANDIT — get active/accepted session
───────────────────────────────────────────── */
exports.getPanditActiveSession = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const session = await AstroSession.findOne({
    panditId: pandit._id,
    status:   { $in: ['waiting', 'accepted', 'active', 'expired'] },
  })
    .populate('userId', 'name profilePhoto');

  // Auto-expire on rejoin — if paidUntil has passed, mark expired so pandit sees the correct state
  if (session && session.status === 'active' && session.paidUntil && new Date() > new Date(session.paidUntil)) {
    session.status = 'expired';
    await session.save();
  }

  res.json({ success: true, data: session || null });
};

/* ─────────────────────────────────────────────
   PANDIT — accept a waiting session
───────────────────────────────────────────── */
exports.acceptSession = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.panditId.toString() !== pandit._id.toString()) return res.status(403).json({ success: false, message: 'Access denied.' });
  if (session.status !== 'waiting') return res.status(400).json({ success: false, message: 'Session is no longer waiting.' });

  // Status → accepted; user now needs to pay to activate
  session.status = 'accepted';
  await session.save();

  await session.populate('userId', 'name');

  res.json({ success: true, data: session, message: 'Request accepted! Waiting for user to pay.' });
};

/* ─────────────────────────────────────────────
   PANDIT — reject a waiting session
───────────────────────────────────────────── */
exports.rejectSession = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.panditId.toString() !== pandit._id.toString()) return res.status(403).json({ success: false, message: 'Access denied.' });
  if (session.status !== 'waiting') return res.status(400).json({ success: false, message: 'Session is no longer waiting.' });

  session.status        = 'rejected';
  session.rejectionNote = req.body.note || '';
  session.endTime       = new Date();
  await session.save();

  res.json({ success: true, data: session, message: 'Request rejected.' });
};

/* ─────────────────────────────────────────────
   PANDIT — session history
───────────────────────────────────────────── */
exports.getPanditSessionHistory = async (req, res) => {
  const pandit = await Pandit.findOne({ userId: req.user._id });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit profile not found.' });

  const sessions = await AstroSession.find({ panditId: pandit._id, status: { $in: ['ended', 'cancelled', 'rejected'] } })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('userId', 'name')
    .select('-messages');

  res.json({ success: true, data: sessions });
};

/* ─────────────────────────────────────────────
   ADMIN — enable astrology + set per-min rate
───────────────────────────────────────────── */
exports.adminSetAstroConfig = async (req, res) => {
  const { isAstrologer, astroRate } = req.body;

  const pandit = await Pandit.findByIdAndUpdate(
    req.params.panditId,
    { isAstrologer, astroRate },
    { new: true, runValidators: true }
  ).populate('userId', 'name');

  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found.' });

  res.json({ success: true, data: pandit, message: 'Astrology settings updated.' });
};

/* ─────────────────────────────────────────────
   ADMIN — all sessions
───────────────────────────────────────────── */
exports.adminGetAllSessions = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : {};

  const [sessions, total] = await Promise.all([
    AstroSession.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate({ path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo' })
      .populate('userId', 'name email')
      .select('-messages'),
    AstroSession.countDocuments(filter),
  ]);

  res.json({ success: true, data: { sessions, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } } });
};

/* ─────────────────────────────────────────────
   ADMIN — force end a session
───────────────────────────────────────────── */
exports.adminEndSession = async (req, res) => {
  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  if (!['waiting', 'accepted', 'active', 'expired'].includes(session.status)) {
    return res.status(400).json({ success: false, message: 'Session already ended.' });
  }

  session.status  = 'ended';
  session.endTime = new Date();
  session.endedBy = 'admin';
  await session.save();

  res.json({ success: true, data: session, message: 'Session force-ended by admin.' });
};

/* ─────────────────────────────────────────────
   ADMIN — stats
───────────────────────────────────────────── */
exports.adminGetStats = async (req, res) => {
  const [total, active, waiting, accepted, revenue] = await Promise.all([
    AstroSession.countDocuments(),
    AstroSession.countDocuments({ status: 'active' }),
    AstroSession.countDocuments({ status: 'waiting' }),
    AstroSession.countDocuments({ status: 'accepted' }),
    AstroSession.aggregate([
      { $match: { totalPaidAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$totalPaidAmount' } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalSessions:    total,
      activeSessions:   active,
      waitingSessions:  waiting,
      acceptedSessions: accepted,
      totalRevenue:     revenue[0]?.total || 0,
    },
  });
};
