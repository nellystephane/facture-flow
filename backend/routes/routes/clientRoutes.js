const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/clientController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getClients);
router.get('/:id', controller.getClientById);
router.post('/', controller.createClient);
router.put('/:id', controller.updateClient);
router.delete('/:id', controller.deleteClient);

module.exports = router;