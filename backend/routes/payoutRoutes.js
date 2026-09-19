const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/payoutController');
const router = express.Router();

// Confirmation email : volontairement publique, car le lien contient un
// jeton aléatoire à usage unique et à durée limitée. Aucun montant n'est
// transféré par cette route.
router.post('/confirm/:token', controller.confirmDestination);

router.use(auth);
router.get('/summary', controller.getSummary);
router.get('/', controller.list);
router.put('/settings', controller.updateSettings);
router.post('/settings/resend-confirmation', controller.resendConfirmation);
router.post('/request', controller.requestPayout);
router.post('/:id/reconcile', controller.reconcile);
module.exports = router;
