const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/affiliateController');
const router = express.Router();

// Public : utilisé par le lien de recommandation avant toute connexion.
router.get('/public/:code', controller.publicLanding);

router.use(auth);
router.get('/me', controller.me);
router.post('/activate', controller.activate);
router.get('/dashboard', controller.dashboard);

module.exports = router;
