const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadPoojaImage } = require('../config/upload');
const { getAllPoojas, getAllPoojasAdmin, getPoojaById, createPooja, updatePooja, deletePooja } = require('../controllers/poojaController');

router.get('/', getAllPoojas);
router.get('/admin/all', protect, authorize('admin'), getAllPoojasAdmin);
router.get('/:id', getPoojaById);
router.post('/', protect, authorize('admin'), uploadPoojaImage.single('image'), createPooja);
router.put('/:id', protect, authorize('admin'), uploadPoojaImage.single('image'), updatePooja);
router.delete('/:id', protect, authorize('admin'), deletePooja);

module.exports = router;
