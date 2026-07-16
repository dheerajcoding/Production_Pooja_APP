const express       = require('express');
const router        = express.Router();
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const ctrl          = require('../controllers/festivalController');

// Public — for the user dashboard banner slider
router.get('/upcoming', ctrl.getUpcoming);

// Admin — CRUD
router.get(   '/',     protect, authorize('admin'), ctrl.getAll);
router.post(  '/',     protect, authorize('admin'), ctrl.create);
router.patch( '/:id',  protect, authorize('admin'), ctrl.update);
router.delete('/:id',  protect, authorize('admin'), ctrl.remove);

module.exports = router;
