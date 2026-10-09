const express = require('express');
const auth = require('../middleware/auth');
const requireBusinessAccount = require('../middleware/requireBusinessAccount');
const controller = require('../controllers/statsController');
const router = express.Router();

router.use(auth, requireBusinessAccount);

router.get('/dashboard', controller.getDashboard);

module.exports = router;
