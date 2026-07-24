const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/authController');
const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, controller.updateProfile);

module.exports = router;
