const express = require('express');
const controller = require('../controllers/publicController');
const router = express.Router();

// Aucune authentification requise — données agrégées et publiques uniquement.
router.get('/stats', controller.getPublicStats);

module.exports = router;
