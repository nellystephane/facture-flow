const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/paymentController');
const pdfController = require('../controllers/pdfController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getPayments);
router.post('/', controller.createPayment);
router.delete('/:id', controller.deletePayment);
router.get('/:paymentId/recu', pdfController.paymentReceiptPdf);

module.exports = router;
