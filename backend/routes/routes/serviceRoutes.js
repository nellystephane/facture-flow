const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/serviceController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getServices);
router.get('/:id', controller.getServiceById);
router.post('/', controller.createService);
router.put('/:id', controller.updateService);
router.delete('/:id', controller.deleteService);

module.exports = router;
