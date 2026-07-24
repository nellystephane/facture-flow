const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/invoiceController');
const pdfController = require('../controllers/pdfController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getInvoices);
router.get('/:id', controller.getInvoiceById);
router.post('/', controller.createInvoice);
router.put('/:id', controller.updateInvoice);
router.patch('/:id/statut', controller.patchInvoiceStatus);
router.delete('/:id', controller.deleteInvoice);

// PDF d'une facture
router.get('/:id/pdf', pdfController.invoicePdf);
// Statut de paiement d'une facture
router.get('/:id/paiements', pdfController.invoiceStatus);
// Transformer un devis en facture
router.post('/from-quote/:id', controller.createFromQuote);

module.exports = router;
