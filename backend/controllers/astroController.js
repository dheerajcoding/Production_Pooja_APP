const Pandit             = require('../models/Pandit');
const AstroSession       = require('../models/AstroSession');
const User               = require('../models/User');
const WalletTransaction  = require('../models/WalletTransaction');

const BLOCK_MINUTES = 10; // legacy schema field — no longer drives billing

/* ─────────────────────────────────────────────
   HELPER — charge accrued whole minutes since the
   session's lastChargedAt (or startTime for first
   pass). Advances lastChargedAt in whole-minute
   chunks; leaves partial minute for next poll.

   Recomputes paidUntil = now + runway_at_current_wallet.
   Expires the session if the wallet can't cover the
   next unbilled minute.

   Mutates `session` in place (does NOT save it —
   caller should save after other edits).
───────────────────────────────────────────── */
async function chargeAccruedUsage(session) {
  if (session.status !== 'active') return { charged: 0, expired: false, walletBalance: null };

  const now      = new Date();
  const rate     = Number(session.ratePerMinute || 0);
  const anchor   = new Date(session.lastChargedAt || session.startTime || now);
  const elapsed  = now.getTime() - anchor.getTime();
  const wholeMin = Math.max(0, Math.floor(elapsed / 60000));

  const user = await User.findById(session.userId);
  if (!user) return { charged: 0, expired: false, walletBalance: null };

  let charged = 0;
  let expired = false;

  if (wholeMin > 0 && rate > 0) {
    const affordable = Math.min(wholeMin, Math.floor((user.walletBalance || 0) / rate));
    const cost       = affordable * rate;
    if (cost > 0) {
      user.walletBalance = (user.walletBalance || 0) - cost;
      await user.save();
      session.totalPaidMinutes = (session.totalPaidMinutes || 0) + affordable;
      session.totalPaidAmount  = (session.totalPaidAmount  || 0) + cost;
      session.lastChargedAt    = new Date(anchor.getTime() + affordable * 60000);
      charged = affordable;

      await WalletTransaction.create({
        userId:        user._id,
        type:          'debit',
        amount:        cost,
        balanceAfter:  user.walletBalance,
        referenceType: 'astro_session',
        referenceId:   session._id,
        description:   `Astrology chat — ${affordable} min @ ₹${rate}/min`,
      });
    }
    if (affordable < wholeMin) {
      // Wallet ran out mid-usage → mark expired
      session.status  = 'expired';
      session.endTime = now;
      expired = true;
    }
  }

  // Recompute runway based on current wallet balance
  if (rate > 0) {
    const runway = Math.floor((user.walletBalance || 0) / rate);
    session.paidUntil = new Date(now.getTime() + runway * 60000);
  }

  return { charged, expired, walletBalance: user.walletBalance || 0 };
}

/* ─────────────────────────────────────────────
   HELPER — final round-up charge when session
   ends while active. Any partial minute since
   lastChargedAt is billed as one full minute
   (if the wallet can cover it).
───────────────────────────────────────────── */
async function chargeFinalPartialMinute(session) {
  if (!['active', 'expired'].includes(session.status)) return { charged: 0, walletBalance: null };
  const now    = new Date();
  const rate   = Number(session.ratePerMinute || 0);
  const anchor = new Date(session.lastChargedAt || session.startTime || now);
  const remainingMs = now.getTime() - anchor.getTime();
  if (remainingMs <= 0 || rate <= 0) return { charged: 0, walletBalance: null };

  const user = await User.findById(session.userId);
  if (!user) return { charged: 0, walletBalance: null };

  if ((user.walletBalance || 0) >= rate) {
    user.walletBalance = (user.walletBalance || 0) - rate;
    await user.save();
    session.totalPaidMinutes = (session.totalPaidMinutes || 0) + 1;
    session.totalPaidAmount  = (session.totalPaidAmount  || 0) + rate;
    session.lastChargedAt    = now;

    await WalletTransaction.create({
      userId:        user._id,
      type:          'debit',
      amount:        rate,
      balanceAfter:  user.walletBalance,
      referenceType: 'astro_session',
      referenceId:   session._id,
      description:   `Astrology chat — final partial minute @ ₹${rate}/min`,
    });
    return { charged: 1, walletBalance: user.walletBalance };
  }
  return { charged: 0, walletBalance: user.walletBalance || 0 };
}

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

  if (session && session.status === 'active') {
    await chargeAccruedUsage(session);
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
   No upfront reservation. Wallet is charged per
   completed minute during the chat via
   chargeAccruedUsage on every poll / message.
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

  const balance = user.walletBalance || 0;
  const rate    = Number(session.ratePerMinute || 0);

  if (rate <= 0 || balance < rate) {
    return res.status(400).json({
      success:         false,
      message:         'Insufficient wallet balance. Please top up your wallet to continue.',
      code:            'INSUFFICIENT_BALANCE',
      walletBalance:   balance,
      ratePerMinute:   rate,
      minimumRequired: rate,
    });
  }

  const now    = new Date();
  const runway = Math.floor(balance / rate);

  session.status        = 'active';
  session.startTime     = now;      // (re)set start for THIS active run
  session.lastChargedAt = now;      // charge anchor — advances per minute
  session.paidUntil     = new Date(now.getTime() + runway * 60 * 1000);

  await session.save();

  await session.populate([
    { path: 'panditId', populate: { path: 'userId', select: 'name' }, select: 'userId photo astroRate' },
    { path: 'userId', select: 'name' },
  ]);

  res.json({
    success: true,
    data: {
      session,
      walletBalance:  balance,
      ratePerMinute:  rate,
      runwayMinutes:  runway,
    },
    message: `Chat started! You'll be charged ₹${rate}/min from your wallet as you talk.`,
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

  await chargeAccruedUsage(session);
  if (session.status !== 'active') {
    await session.save();
    return res.status(400).json({ success: false, message: 'Your wallet ran out. Please top up and resume to continue.' });
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

  await chargeAccruedUsage(session);
  if (session.status !== 'active') {
    await session.save();
    return res.status(400).json({ success: false, message: 'Your wallet ran out. Please top up and resume to continue.' });
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
    .select('messages status startTime paidUntil lastChargedAt ratePerMinute totalPaidMinutes totalPaidAmount blockMinutes userId');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  const wasActive = session.status === 'active';
  let walletBalance = null;
  if (wasActive) {
    const result = await chargeAccruedUsage(session);
    walletBalance = result.walletBalance;
    await session.save();
  }
  const expired = wasActive && session.status === 'expired';

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
      walletBalance,
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

  // Charge for any whole minutes that accrued since the last poll,
  // then round up any partial minute of talk-time. This is the
  // per-minute billing model — no upfront reservation, no refund.
  let finalCharge = 0;
  if (session.status === 'active') {
    await chargeAccruedUsage(session);       // whole minutes since lastChargedAt
    const roundUp = await chargeFinalPartialMinute(session);
    finalCharge = roundUp.charged;
  }

  session.status  = 'ended';
  session.endTime = now;
  session.endedBy = req.user.role === 'admin' ? 'admin' : req.user.role;
  await session.save();

  // Fetch the freshly-updated wallet balance so the client doesn't have to
  // make a second round-trip to render the post-charge amount.
  const userAfter = await User.findById(session.userId).select('walletBalance');
  const walletBalance = userAfter?.walletBalance ?? null;

  res.json({
    success:  true,
    data:     session,
    walletBalance,
    message:  finalCharge > 0
      ? `Session ended. Final partial minute rounded up and charged.`
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

  if (session && session.status === 'active') {
    await chargeAccruedUsage(session);
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
