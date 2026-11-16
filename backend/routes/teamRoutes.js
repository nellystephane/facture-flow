const express = require('express');
const auth = require('../middleware/auth');
const requireProprietaireOuAdmin = require('../middleware/requireProprietaireOuAdmin');
const validate = require('../middleware/validate');
const { inviteMemberSchema, updateMemberRoleSchema } = require('../validators/teamValidators');
const controller = require('../controllers/teamController');
const router = express.Router();

router.use(auth);

router.get('/', controller.getMembers);
router.get('/activite', requireProprietaireOuAdmin, controller.getActivite);
router.post('/inviter', requireProprietaireOuAdmin, validate(inviteMemberSchema), controller.inviteMember);
router.put('/:id/role', requireProprietaireOuAdmin, validate(updateMemberRoleSchema), controller.updateMemberRole);
router.delete('/:id', requireProprietaireOuAdmin, controller.removeMember);

module.exports = router;
