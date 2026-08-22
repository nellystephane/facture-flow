const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/statsController');
const router = express.Router();

router.use(auth);

router.get('/dashboard', controller.getDashboard);

module.exports = router;
