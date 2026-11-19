const express = require('express');
const auth = require('../middleware/auth');
const requireFeature = require('../middleware/requireFeature');
const requireProprietaireOuAdmin = require('../middleware/requireProprietaireOuAdmin');
const validate = require('../middleware/validate');
const { createRecurringSchema, updateRecurringSchema } = require('../validators/recurringValidators');
const controller = require('../controllers/recurringController');
const router = express.Router();

router.use(auth);
router.use(requireFeature('facturesRecurrentes'));

router.get('/', controller.getRecurring);
router.post('/', requireProprietaireOuAdmin, validate(createRecurringSchema), controller.createRecurring);
router.put('/:id', requireProprietaireOuAdmin, validate(updateRecurringSchema), controller.updateRecurring);
router.patch('/:id/actif', requireProprietaireOuAdmin, controller.setActif);
router.delete('/:id', requireProprietaireOuAdmin, controller.deleteRecurring);

module.exports = router;
