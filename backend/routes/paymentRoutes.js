const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createPaymentSchema } = require('../validators/paymentValidators');
const controller = require('../controllers/paymentController');
const pdfController = require('../controllers/pdfController');
const router = express.Router();

router.use(auth);

router.get('/stats', controller.getPaymentsStats);
router.get('/', controller.getPayments);
router.post('/', validate(createPaymentSchema), controller.createPayment);
router.delete('/:id', controller.deletePayment);
router.get('/:paymentId/recu', pdfController.paymentReceiptPdf);

module.exports = router;
