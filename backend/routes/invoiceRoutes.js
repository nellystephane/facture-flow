const express = require('express');
const auth = require('../middleware/auth');
const requireBusinessAccount = require('../middleware/requireBusinessAccount');
const requireFeature = require('../middleware/requireFeature');
const validate = require('../middleware/validate');
const { createInvoiceSchema, updateInvoiceSchema, patchInvoiceStatusSchema } = require('../validators/invoiceValidators');
const controller = require('../controllers/invoiceController');
const pdfController = require('../controllers/pdfController');
const router = express.Router();

router.use(auth, requireBusinessAccount);

router.get('/', controller.getInvoices);
router.get('/export', requireFeature('exportComptable'), controller.exportComptable);
router.post('/preview', validate(createInvoiceSchema), controller.previewInvoicePdf);
router.get('/:id', controller.getInvoiceById);
router.post('/', validate(createInvoiceSchema), controller.createInvoice);
router.put('/:id', validate(updateInvoiceSchema), controller.updateInvoice);
router.patch('/:id/statut', validate(patchInvoiceStatusSchema), controller.patchInvoiceStatus);
router.delete('/:id', controller.deleteInvoice);

router.get('/:id/pdf', pdfController.invoicePdf);
router.get('/:id/paiements', pdfController.invoiceStatus);
router.post('/from-quote/:id', controller.createFromQuote);
router.post('/from-service', requireFeature('facturationExpress'), controller.createFromService);
router.post('/:id/envoyer', controller.sendInvoiceEmail);
router.post('/:id/lien-public/revoquer', controller.revokePublicLink);
router.post('/:id/lien-public/regenerer', controller.regeneratePublicLink);

module.exports = router;
