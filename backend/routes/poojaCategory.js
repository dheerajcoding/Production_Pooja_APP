const express       = require('express');
const router        = express.Router();
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const ctrl          = require('../controllers/poojaCategoryController');

// Public — clients fetch this for filter pills / admin form dropdowns
router.get('/', ctrl.getAll);

// Admin — CRUD
router.post(  '/',    protect, authorize('admin'), ctrl.create);
router.patch( '/:id', protect, authorize('admin'), ctrl.update);
router.delete('/:id', protect, authorize('admin'), ctrl.remove);

module.exports = router;
