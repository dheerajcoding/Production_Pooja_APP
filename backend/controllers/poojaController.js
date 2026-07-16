const fs = require('fs');
const path = require('path');
const Pooja = require('../models/Pooja');

const getFileUrl = (req, filename) => {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/poojas/${path.basename(filename)}`;
};

const deleteOldFile = (filename) => {
  if (filename) {
    const fullPath = path.join(__dirname, '../uploads/poojas', path.basename(filename));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
};

exports.getAllPoojas = async (req, res) => {
  const { category, page = 1, limit = 12, search, featured } = req.query;
  const query = { isActive: true };
  if (category) query.category = category;
  if (search) query.name = { $regex: search, $options: 'i' };
  if (featured === 'true') query.isFeatured = true;

  const poojas = await Pooja.find(query)
    .sort({ bookingCount: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Pooja.countDocuments(query);

  res.json({
    success: true,
    data: {
      poojas,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.getPoojaById = async (req, res) => {
  const pooja = await Pooja.findById(req.params.id);
  if (!pooja) return res.status(404).json({ success: false, message: 'Pooja not found.' });
  res.json({ success: true, data: pooja });
};

exports.createPooja = async (req, res) => {
  const { name, description, category, duration, price, includedItems } = req.body;

  const poojaData = {
    name,
    description,
    category,
    duration,
    price: parseFloat(price),
    includedItems: Array.isArray(includedItems)
      ? includedItems
      : includedItems ? includedItems.split(',').map((i) => i.trim()) : [],
  };

  if (req.file) {
    poojaData.image = getFileUrl(req, req.file.filename);
    poojaData.imagePublicId = req.file.filename;
  }

  const pooja = await Pooja.create(poojaData);
  res.status(201).json({ success: true, message: 'Pooja created.', data: pooja });
};

exports.updatePooja = async (req, res) => {
  const pooja = await Pooja.findById(req.params.id);
  if (!pooja) return res.status(404).json({ success: false, message: 'Pooja not found.' });

  const { name, description, category, duration, price, includedItems, isActive, isFeatured } = req.body;

  if (name) pooja.name = name;
  if (description) pooja.description = description;
  if (category) pooja.category = category;
  if (duration) pooja.duration = duration;
  if (price) pooja.price = parseFloat(price);
  if (isActive !== undefined) pooja.isActive = isActive === 'true' || isActive === true;
  if (isFeatured !== undefined) pooja.isFeatured = isFeatured === 'true' || isFeatured === true;
  if (includedItems) pooja.includedItems = Array.isArray(includedItems) ? includedItems : includedItems.split(',').map((i) => i.trim());

  if (req.file) {
    deleteOldFile(pooja.imagePublicId);
    pooja.image = getFileUrl(req, req.file.filename);
    pooja.imagePublicId = req.file.filename;
  }

  await pooja.save();
  res.json({ success: true, message: 'Pooja updated.', data: pooja });
};

exports.deletePooja = async (req, res) => {
  const pooja = await Pooja.findById(req.params.id);
  if (!pooja) return res.status(404).json({ success: false, message: 'Pooja not found.' });

  deleteOldFile(pooja.imagePublicId);
  await pooja.deleteOne();

  res.json({ success: true, message: 'Pooja deleted.' });
};
