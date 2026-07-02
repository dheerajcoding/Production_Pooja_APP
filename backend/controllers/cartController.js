const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  if (!cart) cart = { items: [], totalAmount: 0, totalItems: 0 };
  res.json({ success: true, data: cart });
};

exports.addToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return res.status(404).json({ success: false, message: 'Product not found or unavailable.' });
  }
  if (product.stock < quantity) {
    return res.status(400).json({ success: false, message: `Only ${product.stock} items in stock.` });
  }

  const finalPrice = product.discountPrice > 0 ? product.discountPrice : product.price;

  let cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    cart = await Cart.create({
      userId: req.user._id,
      items: [{ productId, quantity, priceAtAdd: finalPrice }],
    });
  } else {
    const existingItem = cart.items.find((i) => i.productId.toString() === productId);
    if (existingItem) {
      existingItem.quantity += parseInt(quantity);
      if (existingItem.quantity > product.stock) {
        existingItem.quantity = product.stock;
      }
    } else {
      cart.items.push({ productId, quantity: parseInt(quantity), priceAtAdd: finalPrice });
    }
    await cart.save();
  }

  await cart.populate('items.productId');
  res.json({ success: true, message: 'Added to cart.', data: cart });
};

exports.updateCartItem = async (req, res) => {
  const { productId, quantity } = req.body;

  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });

  const item = cart.items.find((i) => i.productId.toString() === productId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not in cart.' });

  if (parseInt(quantity) <= 0) {
    cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
  } else {
    const product = await Product.findById(productId);
    item.quantity = Math.min(parseInt(quantity), product.stock);
  }

  await cart.save();
  await cart.populate('items.productId');
  res.json({ success: true, message: 'Cart updated.', data: cart });
};

exports.removeFromCart = async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });

  cart.items = cart.items.filter((i) => i.productId.toString() !== req.params.productId);
  await cart.save();
  await cart.populate('items.productId');
  res.json({ success: true, message: 'Item removed from cart.', data: cart });
};

exports.clearCart = async (req, res) => {
  await Cart.findOneAndUpdate({ userId: req.user._id }, { items: [] });
  res.json({ success: true, message: 'Cart cleared.' });
};
