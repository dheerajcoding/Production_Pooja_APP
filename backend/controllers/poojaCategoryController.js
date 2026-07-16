const PoojaCategory = require('../models/PoojaCategory');
const Pooja         = require('../models/Pooja');

const slugify = (s) => String(s || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

/* ─────────────────────────────────────────────
   PUBLIC — GET /api/pooja-categories
   Returns active categories sorted for the client
   (filter pills, admin dropdowns, festival links).
───────────────────────────────────────────── */
exports.getAll = async (req, res) => {
  const includeInactive = req.query.all === 'true';
  const query = includeInactive ? {} : { isActive: true };
  const categories = await PoojaCategory.find(query).sort({ sortOrder: 1, name: 1 });
  res.json({ success: true, data: categories });
};

/* ─────────────────────────────────────────────
   ADMIN — POST /api/pooja-categories
   Body: { name, emoji?, sortOrder?, isActive? }
───────────────────────────────────────────── */
exports.create = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'name is required.' });

  const slug = slugify(name);
  const existing = await PoojaCategory.findOne({ $or: [{ name: name.trim() }, { slug }] });
  if (existing) return res.status(400).json({ success: false, message: 'Category with that name already exists.' });

  const category = await PoojaCategory.create({
    name:      name.trim(),
    slug,
    emoji:     req.body.emoji || '🪔',
    sortOrder: Number(req.body.sortOrder) || 0,
    isActive:  req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
  });
  res.status(201).json({ success: true, data: category });
};

/* ─────────────────────────────────────────────
   ADMIN — PATCH /api/pooja-categories/:id
───────────────────────────────────────────── */
exports.update = async (req, res) => {
  const category = await PoojaCategory.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

  const oldName = category.name;

  if (req.body.name !== undefined) {
    const trimmed = req.body.name.trim();
    if (!trimmed) return res.status(400).json({ success: false, message: 'name cannot be empty.' });
    // If renaming, cascade the new name onto existing poojas that used the old name.
    if (trimmed !== category.name) {
      category.name = trimmed;
      category.slug = slugify(trimmed);
      await Pooja.updateMany({ category: oldName }, { $set: { category: trimmed } });
    }
  }
  ['emoji', 'isActive', 'sortOrder'].forEach((f) => {
    if (req.body[f] !== undefined) category[f] = req.body[f];
  });

  await category.save();
  res.json({ success: true, data: category });
};

/* ─────────────────────────────────────────────
   ADMIN — DELETE /api/pooja-categories/:id
   Refuses deletion if any active pooja still uses it
   (unless ?force=true is passed and reassignTo is provided).
   Optionally: pass ?reassignTo=Other to move existing poojas to a new category first.
───────────────────────────────────────────── */
exports.remove = async (req, res) => {
  const category = await PoojaCategory.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

  const inUseCount = await Pooja.countDocuments({ category: category.name, isActive: true });
  if (inUseCount > 0) {
    const reassignTo = req.query.reassignTo;
    if (!reassignTo) {
      return res.status(400).json({
        success: false,
        message: `${inUseCount} active pooja(s) still use this category. Pass ?reassignTo=<other-category> to reassign them, or deactivate the poojas first.`,
      });
    }
    // Verify reassignment target exists
    const target = await PoojaCategory.findOne({ name: reassignTo, isActive: true });
    if (!target) {
      return res.status(400).json({ success: false, message: `Target category '${reassignTo}' not found or inactive.` });
    }
    await Pooja.updateMany({ category: category.name }, { $set: { category: target.name } });
  }

  await PoojaCategory.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Category removed.' });
};

/* ─────────────────────────────────────────────
   Seed — called on server boot to populate the
   default set once, if the collection is empty.
───────────────────────────────────────────── */
exports.seedDefaults = async () => {
  const count = await PoojaCategory.countDocuments();
  if (count > 0) return;
  const defaults = [
    { name: 'Griha Pravesh',      emoji: '🏠', sortOrder: 1 },
    { name: 'Satyanarayan Katha', emoji: '📿', sortOrder: 2 },
    { name: 'Navratri',           emoji: '🌺', sortOrder: 3 },
    { name: 'Ganesh Puja',        emoji: '🐘', sortOrder: 4 },
    { name: 'Laxmi Puja',         emoji: '🪔', sortOrder: 5 },
    { name: 'Shradh',             emoji: '🙏', sortOrder: 6 },
    { name: 'Vivah',              emoji: '💍', sortOrder: 7 },
    { name: 'Namkaran',           emoji: '👶', sortOrder: 8 },
    { name: 'Mundan',             emoji: '✂️', sortOrder: 9 },
    { name: 'Other',              emoji: '✨', sortOrder: 99 },
  ].map((c) => ({ ...c, slug: slugify(c.name), isActive: true }));
  await PoojaCategory.insertMany(defaults);
};
