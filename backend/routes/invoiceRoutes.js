const express = require('express');
const auth = require('../middleware/auth');
const requireFeature = require('../middleware/requireFeature');
const validate = require('../middleware/validate');
const { createInvoiceSchema, updateInvoiceSchema, patchInvoiceStatusSchema } = require('../validators/invoiceValidators');
const controller = require('../controllers/invoiceController');
const pdfController = require('../controllers/pdfController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getInvoices);
router.get('/export', requireFeature('exportComptable'), controller.exportComptable);
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

module.exports = router;
