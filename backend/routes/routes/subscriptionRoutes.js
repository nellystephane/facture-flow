const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/subscriptionController');
const router = express.Router();

router.get('/plans', controller.getPlans);
router.use(auth);
router.post('/subscribe', controller.subscribe);
router.get('/statut', controller.getStatus);

module.exports = router;
