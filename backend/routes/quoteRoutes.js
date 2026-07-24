const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/quoteController');
const pdfController = require('../controllers/pdfController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getQuotes);
router.get('/:id', controller.getQuoteById);
router.post('/', controller.createQuote);
router.put('/:id', controller.updateQuote);
router.patch('/:id/statut', controller.patchQuoteStatus);
router.delete('/:id', controller.deleteQuote);
router.get('/:id/pdf', pdfController.quotePdf);

module.exports = router;
