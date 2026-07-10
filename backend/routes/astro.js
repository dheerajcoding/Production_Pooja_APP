const express  = require('express');
const router   = express.Router();
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadChatImage } = require('../config/upload');
const ctrl = require('../controllers/astroController');

// ── Public ──────────────────────────────────────────────────
router.get('/pandits', ctrl.getLiveAstrologers);

// ── User ────────────────────────────────────────────────────
router.post('/session/request',                protect, authorize('user'),   ctrl.requestSession);
router.get( '/session/active',                 protect, authorize('user'),   ctrl.getMyActiveSession);
router.get( '/sessions/my',                    protect, authorize('user'),   ctrl.getMySessionHistory);
router.put( '/session/:id/cancel',             protect, authorize('user'),   ctrl.cancelRequest);
router.post('/session/:id/start',              protect, authorize('user'),   ctrl.startChatFromWallet);

// ── Pandit ───────────────────────────────────────────────────
router.put('/pandit/toggle-live',              protect, authorize('pandit'), ctrl.toggleLive);
router.get('/pandit/requests',                 protect, authorize('pandit'), ctrl.getIncomingRequests);
router.get('/pandit/session/active',           protect, authorize('pandit'), ctrl.getPanditActiveSession);
router.get('/pandit/sessions/history',         protect, authorize('pandit'), ctrl.getPanditSessionHistory);
router.put('/pandit/session/:id/accept',       protect, authorize('pandit'), ctrl.acceptSession);
router.put('/pandit/session/:id/reject',       protect, authorize('pandit'), ctrl.rejectSession);

// ── Shared (user + pandit) ───────────────────────────────────
router.get( '/session/:id',                    protect, ctrl.getSessionById);
router.get( '/session/:id/messages',           protect, ctrl.getMessages);
router.post('/session/:id/message',            protect, ctrl.sendMessage);
router.post('/session/:id/image',              protect, uploadChatImage.single('image'), ctrl.sendImageMessage);
router.put( '/session/:id/end',                protect, ctrl.endSession);

// ── Admin ────────────────────────────────────────────────────
router.get('/admin/stats',                     protect, authorize('admin'),  ctrl.adminGetStats);
router.get('/admin/sessions',                  protect, authorize('admin'),  ctrl.adminGetAllSessions);
router.put('/admin/pandit/:panditId',          protect, authorize('admin'),  ctrl.adminSetAstroConfig);
router.put('/admin/session/:id/end',           protect, authorize('admin'),  ctrl.adminEndSession);

module.exports = router;
