const Pandit       = require('../models/Pandit');
const AstroSession = require('../models/AstroSession');
const Razorpay     = require('razorpay');
const crypto       = require('crypto');

const getRazorpay = () => new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const BLOCK_MINUTES = 10; // fixed block size

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
   USER — create Razorpay order for 10-min block
   (works for initial payment after acceptance AND recharge)
───────────────────────────────────────────── */
exports.createBlockPayment = async (req, res) => {
  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Access denied.' });

  const allowedStatuses = ['accepted', 'expired'];
  if (!allowedStatuses.includes(session.status)) {
    return res.status(400).json({ success: false, message: `Cannot pay for a session with status: ${session.status}.` });
  }

  const blockAmount = BLOCK_MINUTES * session.ratePerMinute;

  // receipt must be ≤ 40 chars — use last 8 chars of session ID + epoch seconds
  const receipt = `as_${String(session._id).slice(-8)}_${Math.floor(Date.now() / 1000)}`;

  const order = await getRazorpay().orders.create({
    amount:   Math.round(blockAmount * 100),
    currency: 'INR',
    receipt,
  });

  session.razorpayOrderId = order.id;
  await session.save();

  res.json({
    success: true,
    data: {
      orderId:      order.id,
      amount:       order.amount,
      currency:     order.currency,
      sessionId:    session._id,
      blockMinutes: BLOCK_MINUTES,
      blockAmount,
      keyId:        process.env.RAZORPAY_KEY_ID,
    },
  });
};

/* ─────────────────────────────────────────────
   USER — verify payment → activate / extend session
───────────────────────────────────────────── */
exports.verifyBlockPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed.' });
  }

  const session = await AstroSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  const blockAmount  = BLOCK_MINUTES * session.ratePerMinute;
  const now          = new Date();

  // For recharge: extend from now; for initial: set startTime
  const baseTime = session.status === 'expired' ? now : now;

  session.status           = 'active';
  session.paidUntil        = new Date(baseTime.getTime() + BLOCK_MINUTES * 60 * 1000);
  session.totalPaidMinutes = (session.totalPaidMinutes || 0) + BLOCK_MINUTES;
  session.totalPaidAmount  = (session.totalPaidAmount  || 0) + blockAmount;
  session.lastPaymentId    = razorpay_payment_id;
  if (!session.startTime) session.startTime = now;

  await session.save();

  await session.populate([
    { path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo astroRate' },
    { path: 'userId', select: 'name' },
  ]);

  res.json({ success: true, data: session, message: `Chat started! You have ${BLOCK_MINUTES} minutes.` });
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
  if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Chat is not active. Please pay to start.' });

  // Auto-expire if paidUntil has passed
  if (session.paidUntil && new Date() > new Date(session.paidUntil)) {
    session.status = 'expired';
    await session.save();
    return res.status(400).json({ success: false, message: 'Your 10 minutes are up. Please recharge to continue.' });
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
  if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Chat is not active. Please pay to start.' });

  // Auto-expire check
  if (session.paidUntil && new Date() > new Date(session.paidUntil)) {
    session.status = 'expired';
    await session.save();
    return res.status(400).json({ success: false, message: 'Your 10 minutes are up. Please recharge to continue.' });
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

  session.status  = 'ended';
  session.endTime = new Date();
  session.endedBy = req.user.role === 'admin' ? 'admin' : req.user.role;
  await session.save();

  res.json({ success: true, data: session, message: 'Session ended.' });
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
