const fs = require('fs');
const path = require('path');
const Festival = require('../models/Festival');

const getImageUrl = (req, filename) => {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/festivals/${path.basename(filename)}`;
};

const deleteOldFile = (filename) => {
  if (!filename) return;
  const fp = path.join(__dirname, '../uploads/festivals', path.basename(filename));
  if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
};

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
  const data = {
    name:          name.trim(),
    date:          new Date(date),
    description:   req.body.description || '',
    imageUrl:      req.body.imageUrl || '',
    emoji:         req.body.emoji || '🪔',
    poojaCategory: req.body.poojaCategory || '',
    // Mongoose casts the string 'true'/'false' that multipart form-data
    // sends just as correctly as a real boolean, so no manual Boolean()
    // wrapping here (that would make the string 'false' truthy).
    isActive:      req.body.isActive !== undefined ? req.body.isActive : true,
    sortOrder:     Number(req.body.sortOrder) || 0,
  };

  if (req.file) {
    data.imageUrl = getImageUrl(req, req.file.filename);
    data.imagePublicId = req.file.filename;
  }

  const festival = await Festival.create(data);
  res.status(201).json({ success: true, data: festival });
};

/* ─────────────────────────────────────────────
   ADMIN — PATCH /api/festivals/:id
───────────────────────────────────────────── */
exports.update = async (req, res) => {
  const existing = await Festival.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Festival not found.' });

  const updates = {};
  const fields = ['name', 'description', 'imageUrl', 'emoji', 'poojaCategory', 'isActive', 'sortOrder'];
  fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (req.body.date !== undefined) updates.date = new Date(req.body.date);

  if (req.file) {
    deleteOldFile(existing.imagePublicId);
    updates.imageUrl = getImageUrl(req, req.file.filename);
    updates.imagePublicId = req.file.filename;
  }

  const festival = await Festival.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true,
  });
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
