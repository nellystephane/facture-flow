const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createExpenseSchema, updateExpenseSchema } = require('../validators/expenseValidators');
const controller = require('../controllers/expenseController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getExpenses);
router.get('/summary', controller.getExpensesSummary);
router.post('/', validate(createExpenseSchema), controller.createExpense);
router.put('/:id', validate(updateExpenseSchema), controller.updateExpense);
router.delete('/:id', controller.deleteExpense);

module.exports = router;
