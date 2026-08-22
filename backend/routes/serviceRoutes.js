const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createServiceSchema, updateServiceSchema } = require('../validators/serviceValidators');
const controller = require('../controllers/serviceController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getServices);
router.get('/:id', controller.getServiceById);
router.post('/', validate(createServiceSchema), controller.createService);
router.put('/:id', validate(updateServiceSchema), controller.updateService);
router.delete('/:id', controller.deleteService);

module.exports = router;
