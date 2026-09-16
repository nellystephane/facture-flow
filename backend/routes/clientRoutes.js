const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createClientSchema, updateClientSchema } = require('../validators/clientValidators');
const controller = require('../controllers/clientController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getClients);
router.get('/:id', controller.getClientById);
router.post('/', validate(createClientSchema), controller.createClient);
router.put('/:id', validate(updateClientSchema), controller.updateClient);
router.delete('/:id', controller.deleteClient);

module.exports = router;
