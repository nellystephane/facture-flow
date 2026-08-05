const express = require('express');
const controller = require('../controllers/publicController');
const router = express.Router();

// Aucune authentification requise — utilisé par la landing page et la page
// de paiement client (accès via jeton uniquement, jamais par ID de facture).
router.get('/stats', controller.getPublicStats);
router.get('/invoices/:token', controller.getPublicInvoice);
router.post('/invoices/:token/pay', controller.initiateOnlinePayment);
router.get('/invoices/:token/statut', controller.getPublicPaymentStatus);
router.get('/invoices/:token/receipt/:paymentId', controller.getPublicReceipt);

module.exports = router;
