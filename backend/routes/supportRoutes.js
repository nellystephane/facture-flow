const express = require('express');
const router = express.Router();
const support = require('../controllers/supportController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/', support.listMine);
router.post('/', support.create);
router.get('/:id', support.getMine);
router.post('/:id/messages', support.replyMine);

module.exports = router;
