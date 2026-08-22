const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/authValidators');
const controller = require('../controllers/authController');
const router = express.Router();

router.post('/register', controller.register);
router.post('/verifier-email', controller.verifyEmail);
router.post('/renvoyer-code', controller.resendVerificationCode);
router.post('/login', controller.login);
router.post('/mot-de-passe-oublie', controller.forgotPassword);
router.post('/reinitialiser-mot-de-passe', controller.resetPassword);
router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, validate(updateProfileSchema), controller.updateProfile);
router.post('/profile/logo', auth, controller.uploadLogo);
router.delete('/profile/logo', auth, controller.removeLogo);

module.exports = router;
