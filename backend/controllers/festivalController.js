const Festival = require('../models/Festival');

/* ─────────────────────────────────────────────
   PUBLIC — GET /api/festivals/upcoming
   Returns the next N active festivals sorted
   by date. Past festivals are excluded so the
   banner never shows stale entries.
───────────────────────────────────────────── */
exports.getUpcoming = async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 6));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const festivals = await Festival.find({
    isActive: true,
    date: { $gte: today },
  })
    .sort({ date: 1, sortOrder: 1 })
    .limit(limit);

  res.json({ success: true, data: festivals });
};

/* ─────────────────────────────────────────────
   ADMIN — GET /api/festivals (all, active + inactive)
───────────────────────────────────────────── */
exports.getAll = async (req, res) => {
  const festivals = await Festival.find().sort({ date: 1, sortOrder: 1 });
  res.json({ success: true, data: festivals });
};

/* ─────────────────────────────────────────────
   ADMIN — POST /api/festivals
   Body: { name, date, description?, imageUrl?, emoji?, poojaCategory?, isActive?, sortOrder? }
───────────────────────────────────────────── */
exports.create = async (req, res) => {
  const { name, date } = req.body;
  if (!name?.trim() || !date) {
    return res.status(400).json({ success: false, message: 'name and date are required.' });
  }
  const festival = await Festival.create({
    name:          name.trim(),
    date:          new Date(date),
    description:   req.body.description || '',
    imageUrl:      req.body.imageUrl || '',
    emoji:         req.body.emoji || '🪔',
    poojaCategory: req.body.poojaCategory || '',
    isActive:      req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    sortOrder:     Number(req.body.sortOrder) || 0,
  });
  res.status(201).json({ success: true, data: festival });
};

/* ─────────────────────────────────────────────
   ADMIN — PATCH /api/festivals/:id
───────────────────────────────────────────── */
exports.update = async (req, res) => {
  const updates = {};
  const fields = ['name', 'description', 'imageUrl', 'emoji', 'poojaCategory', 'isActive', 'sortOrder'];
  fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (req.body.date !== undefined) updates.date = new Date(req.body.date);

  const festival = await Festival.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true,
  });
  if (!festival) return res.status(404).json({ success: false, message: 'Festival not found.' });
  res.json({ success: true, data: festival });
};

/* ─────────────────────────────────────────────
   ADMIN — DELETE /api/festivals/:id
───────────────────────────────────────────── */
exports.remove = async (req, res) => {
  const festival = await Festival.findByIdAndDelete(req.params.id);
  if (!festival) return res.status(404).json({ success: false, message: 'Festival not found.' });
  res.json({ success: true, message: 'Festival removed.' });
};
