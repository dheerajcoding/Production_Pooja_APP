const express = require('express');
const router  = express.Router();
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const ctrl = require('../controllers/walletController');

router.get( '/balance',        protect, authorize('user'), ctrl.getBalance);
router.get( '/transactions',   protect, authorize('user'), ctrl.getTransactions);
router.post('/topup/create',   protect, authorize('user'), ctrl.createTopupOrder);
router.post('/topup/verify',   protect, authorize('user'), ctrl.verifyTopupPayment);

module.exports = router;
