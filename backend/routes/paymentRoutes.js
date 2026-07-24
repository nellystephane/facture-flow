const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/paymentController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getPayments);
router.post('/', controller.createPayment);
router.delete('/:id', controller.deletePayment);

module.exports = router;
