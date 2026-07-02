const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { createOrder, createOrderPayment, verifyOrderPayment, getMyOrders, getOrderById, getAllOrders, updateOrderStatus } = require('../controllers/orderController');

// User routes
router.post('/', protect, authorize('user'), createOrder);
router.post('/payment/create', protect, authorize('user'), createOrderPayment);
router.post('/payment/verify', protect, authorize('user'), verifyOrderPayment);
router.get('/my', protect, authorize('user'), getMyOrders);
router.get('/:id', protect, getOrderById);

// Admin routes
router.get('/', protect, authorize('admin'), getAllOrders);
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

module.exports = router;
