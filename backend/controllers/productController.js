const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

const getFileUrl = (req, filename) => {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/products/${path.basename(filename)}`;
};

const deleteOldFile = (filename) => {
  if (filename) {
    const fullPath = path.join(__dirname, '../uploads/products', path.basename(filename));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
};

exports.getAllProducts = async (req, res) => {
  const { category, page = 1, limit = 12, search, sort = 'newest' } = req.query;
  const query = { isActive: true };
  if (category) query.category = category;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { tags: { $in: [new RegExp(search, 'i')] } },
  ];

  const sortOptions = {
    newest: { createdAt: -1 },
    price_low: { price: 1 },
    price_high: { price: -1 },
    popular: { soldCount: -1 },
  };

  const products = await Product.find(query)
    .sort(sortOptions[sort] || { createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Product.countDocuments(query);

  res.json({
    success: true,
    data: {
      products,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
  res.json({ success: true, data: product });
};

exports.createProduct = async (req, res) => {
  const { name, description, category, price, discountPrice, stock, relatedPoojas, tags } = req.body;

  const productData = {
    name,
    description,
    category,
    price: parseFloat(price),
    discountPrice: parseFloat(discountPrice) || 0,
    stock: parseInt(stock) || 0,
    relatedPoojas: relatedPoojas ? (Array.isArray(relatedPoojas) ? relatedPoojas : relatedPoojas.split(',').map((r) => r.trim())) : [],
    tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
  };

  if (req.file) {
    productData.image = getFileUrl(req, req.file.filename);
    productData.imagePublicId = req.file.filename;
  }

  const product = await Product.create(productData);
  res.status(201).json({ success: true, message: 'Product created.', data: product });
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

  const { name, description, category, price, discountPrice, stock, relatedPoojas, tags, isActive } = req.body;

  if (name) product.name = name;
  if (description) product.description = description;
  if (category) product.category = category;
  if (price !== undefined) product.price = parseFloat(price);
  if (discountPrice !== undefined) product.discountPrice = parseFloat(discountPrice) || 0;
  if (stock !== undefined) product.stock = parseInt(stock);
  if (isActive !== undefined) product.isActive = isActive === 'true' || isActive === true;
  if (relatedPoojas) product.relatedPoojas = Array.isArray(relatedPoojas) ? relatedPoojas : relatedPoojas.split(',').map((r) => r.trim());
  if (tags) product.tags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());

  if (req.file) {
    deleteOldFile(product.imagePublicId);
    product.image = getFileUrl(req, req.file.filename);
    product.imagePublicId = req.file.filename;
  }

  await product.save();
  res.json({ success: true, message: 'Product updated.', data: product });
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

  deleteOldFile(product.imagePublicId);
  await product.deleteOne();

  res.json({ success: true, message: 'Product deleted.' });
};
