const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ALLOWED_REFUND_PERCENTS = [100, 70, 50];

// Create order from cart
exports.createOrder = async (req, res) => {
  const { address, deliveryNotes } = req.body;

  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ success: false, message: 'Your cart is empty.' });
  }

  // Validate stock for all items
  for (const item of cart.items) {
    const product = item.productId;
    if (!product || !product.isActive) {
      return res.status(400).json({ success: false, message: `Product "${product?.name}" is no longer available.` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.stock} units of "${product.name}" available.` });
    }
  }

  const orderItems = cart.items.map((item) => ({
    productId: item.productId._id,
    name: item.productId.name,
    image: item.productId.image,
    price: item.priceAtAdd,
    quantity: item.quantity,
  }));

  const totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const order = await Order.create({
    userId: req.user._id,
    items: orderItems,
    totalAmount,
    address,
    deliveryNotes,
  });

  res.status(201).json({ success: true, message: 'Order created. Proceed to payment.', data: order });
};

// Create Razorpay order for shop order
exports.createOrderPayment = async (req, res) => {
  const { orderId } = req.body;
  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (order.isPaid) return res.status(400).json({ success: false, message: 'Order already paid.' });

  const razorpay = getRazorpay();
  const rzpOrder = await razorpay.orders.create({
    amount: Math.round(order.totalAmount * 100),
    currency: 'INR',
    receipt: `order_${orderId}`,
    notes: { orderId: orderId.toString(), userId: req.user._id.toString() },
  });

  order.razorpayOrderId = rzpOrder.id;
  await order.save();

  res.json({
    success: true,
    data: {
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      shopOrderId: order._id,
    },
  });
};

// Verify payment + deduct stock + clear cart
exports.verifyOrderPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, shopOrderId } = req.body;

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSig !== razorpaySignature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed.' });
  }

  const order = await Order.findOne({ _id: shopOrderId, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (order.razorpayOrderId !== razorpayOrderId) {
    return res.status(400).json({ success: false, message: 'This payment does not match this order.' });
  }
  if (order.isPaid) {
    return res.json({ success: true, message: 'Order already paid.', data: order });
  }

  order.isPaid = true;
  order.status = 'paid';
  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  await order.save();

  // Deduct stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: -item.quantity, soldCount: item.quantity },
    });
  }

  // Clear cart
  await Cart.findOneAndUpdate({ userId: req.user._id }, { items: [] });

  res.json({ success: true, message: 'Payment successful! Order placed.', data: order });
};

exports.getMyOrders = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const query = { userId: req.user._id };
  if (status) query.status = status;

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Order.countDocuments(query);

  res.json({
    success: true,
    data: {
      orders,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

exports.getOrderById = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  res.json({ success: true, data: order });
};

exports.cancelOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
    return res.status(400).json({ success: false, message: `Cannot cancel an order that is already ${order.status}.` });
  }

  order.status = 'cancelled';
  order.cancellationReason = req.body.reason || 'Cancelled by user.';
  await order.save();

  res.json({ success: true, message: 'Order cancelled.', data: order });
};

// Admin
exports.getAllOrders = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const query = {};
  if (status) query.status = status;

  const orders = await Order.find(query)
    .populate('userId', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Order.countDocuments(query);
  res.json({ success: true, data: { orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } } });
};

exports.refundOrder = async (req, res) => {
  const percent = Number(req.body.percent);
  if (!ALLOWED_REFUND_PERCENTS.includes(percent)) {
    return res.status(400).json({ success: false, message: 'Refund percent must be 100, 70, or 50.' });
  }

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (!order.isPaid || !order.razorpayPaymentId) {
    return res.status(400).json({ success: false, message: 'This order was never paid.' });
  }
  if (order.refund?.status === 'refunded') {
    return res.status(400).json({ success: false, message: 'This order has already been refunded.' });
  }

  const amountRupees = Math.round(order.totalAmount * percent) / 100;
  const amountPaise  = Math.round(amountRupees * 100);

  let refund;
  try {
    refund = await getRazorpay().payments.refund(order.razorpayPaymentId, {
      amount: amountPaise,
      speed: 'normal',
      notes: { orderId: String(order._id), percent: String(percent) },
    });
  } catch (err) {
    order.refund = { status: 'failed', percent, amount: amountRupees };
    await order.save();
    return res.status(502).json({
      success: false,
      message: err?.error?.description || 'Razorpay refund request failed. Please try again.',
    });
  }

  order.refund = {
    status: 'refunded',
    percent,
    amount: amountRupees,
    razorpayRefundId: refund.id,
    refundedAt: new Date(),
  };
  // Reflect the refund in the order's own status too, so the user sees it
  // on their order's progress/status display.
  order.status = 'refunded';
  await order.save();

  res.json({ success: true, message: `₹${amountRupees} (${percent}%) refunded successfully.`, data: order });
};

exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  res.json({ success: true, message: 'Order status updated.', data: order });
};
