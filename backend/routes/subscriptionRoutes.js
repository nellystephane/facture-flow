const express = require('express');
const auth = require('../middleware/auth');
const requireBusinessAccount = require('../middleware/requireBusinessAccount');
const requireProprietaireOuAdmin = require('../middleware/requireProprietaireOuAdmin');
const controller = require('../controllers/subscriptionController');
const router = express.Router();

router.get('/plans', controller.getPlans);
router.get('/comparatif', controller.getComparatif);
router.use(auth);
router.get('/permissions', requireBusinessAccount, controller.getPermissions);
router.post('/subscribe', requireBusinessAccount, requireProprietaireOuAdmin, controller.subscribe);
router.get('/statut', requireBusinessAccount, controller.getStatus);

module.exports = router;
