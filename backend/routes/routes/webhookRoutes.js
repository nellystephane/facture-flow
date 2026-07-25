const express = require('express');
const controller = require('../controllers/webhookController');
const router = express.Router();

// express.raw() : indispensable pour vérifier la signature HMAC (X-FEDAPAY-SIGNATURE),
// qui doit être calculée sur le corps EXACT reçu, avant tout parsing JSON.
router.post('/fedapay', express.raw({ type: 'application/json' }), controller.fedapayWebhook);

module.exports = router;
