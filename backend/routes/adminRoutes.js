const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const requireAdminAuth = require('../middleware/adminAuth');
const adminAudit = require('../middleware/adminAudit');

// /api/admin/login n'est PAS protégé par requireAdminAuth (c'est justement
// la route qui délivre le token) — mais elle passe par le même
// rate-limiter que /api/auth/login (voir server.js) contre le brute-force.
router.post('/login', admin.login);
router.post('/refresh', admin.refresh);

router.use(requireAdminAuth);
router.use(adminAudit);
router.post('/logout', admin.logout);
router.post('/logout-all', admin.logoutAll);
router.get('/sessions', admin.listSessions);
router.delete('/sessions/:id', admin.revokeSession);

router.get('/stats', admin.getStats);
router.get('/security', admin.getSecurityOverview);
router.post('/email-test', admin.testEmail);
router.get('/finance', admin.getFinancials);

router.get('/users', admin.listUsers);
router.patch('/users/:id/suspendre', admin.suspendreUtilisateur);
router.patch('/users/:id/reactiver', admin.reactiverUtilisateur);
router.patch('/users/:id/plan', admin.changerPlanUtilisateur);

router.get('/payments', admin.listPayments);
router.patch('/payments/:id/litige', admin.signalerLitige);
router.patch('/payments/:id/litige/resoudre', admin.resoudreLitige);
router.patch('/payments/:id/rembourse', admin.marquerRembourse);

router.get('/pricing', admin.getPricing);
router.put('/pricing', admin.updatePricing);

router.get('/affiliation/overview', admin.getAffiliateOverview);
router.get('/affiliation/affiliates', admin.listAffiliates);
router.put('/affiliation/settings', admin.updateAffiliateSettings);

router.get('/support/unread-count', require('../controllers/supportController').adminUnreadCount);
router.get('/support', require('../controllers/supportController').adminList);
router.get('/support/:id', require('../controllers/supportController').adminGet);
router.post('/support/:id/messages', require('../controllers/supportController').adminReply);
router.patch('/support/:id/status', require('../controllers/supportController').adminSetStatus);

router.get('/legal', admin.listLegalContent);
router.put('/legal/:slug', admin.updateLegalContent);

module.exports = router;
