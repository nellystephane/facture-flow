const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/analyticsController');
const router = express.Router();

router.use(auth);
router.get('/catalog', controller.getCatalog);
router.get('/', controller.getAnalytics);

module.exports = router;
