const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createQuoteSchema, updateQuoteSchema, patchQuoteStatusSchema } = require('../validators/quoteValidators');
const controller = require('../controllers/quoteController');
const pdfController = require('../controllers/pdfController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getQuotes);
router.get('/:id', controller.getQuoteById);
router.post('/', validate(createQuoteSchema), controller.createQuote);
router.put('/:id', validate(updateQuoteSchema), controller.updateQuote);
router.patch('/:id/statut', validate(patchQuoteStatusSchema), controller.patchQuoteStatus);
router.delete('/:id', controller.deleteQuote);
router.get('/:id/pdf', pdfController.quotePdf);
router.post('/:id/envoyer', controller.sendQuoteEmail);

module.exports = router;
