const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createServiceSchema, updateServiceSchema } = require('../validators/serviceValidators');
const controller = require('../controllers/serviceController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getServices);
router.get('/unites', controller.getUnites);
router.get('/stock/resume', controller.getStockResume);
router.get('/:id', controller.getServiceById);
router.post('/', validate(createServiceSchema), controller.createService);
router.post('/:id/stock', controller.mouvementStock);
router.get('/:id/mouvements', controller.getMouvements);
router.put('/:id', validate(updateServiceSchema), controller.updateService);
router.delete('/:id', controller.deleteService);

module.exports = router;
