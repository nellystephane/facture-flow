const express = require('express');
const auth = require('../middleware/auth');
const requireProprietaireOuAdmin = require('../middleware/requireProprietaireOuAdmin');
const controller = require('../controllers/subscriptionController');
const router = express.Router();

router.get('/plans', controller.getPlans);
router.get('/comparatif', controller.getComparatif);
router.use(auth);
router.get('/permissions', controller.getPermissions);
router.post('/subscribe', requireProprietaireOuAdmin, controller.subscribe);
router.get('/statut', controller.getStatus);

module.exports = router;
