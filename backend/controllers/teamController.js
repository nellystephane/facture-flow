const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const email = require('../utils/email');
const { permissionsDe } = require('../utils/permissions');

const asyncHandler = require('../middleware/asyncHandler');

const DUREE_CODE_MS = 15 * 60 * 1000;
const ROLE_LABEL = { admin: 'Administrateur', collaborateur: 'Collaborateur' };

function genererCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function compterMembres(ownerId) {
  const membres = await User.countDocuments({ compteProprietaire: ownerId });
  return membres + 1;
}

exports.getMembers = asyncHandler(async (req, res) => {
  const [proprietaire, membres] = await Promise.all([
    User.findById(req.userId).select('nom email role createdAt'),
    User.find({ compteProprietaire: req.userId }).select('nom email role emailVerifie createdAt'),
  ]);
  if (!proprietaire) return res.status(404).json({ message: 'Compte introuvable' });

  const tous = [
    { id: proprietaire._id, nom: proprietaire.nom, email: proprietaire.email, role: 'proprietaire', emailVerifie: true, dateAjout: proprietaire.createdAt },
    ...membres.map((m) => ({ id: m._id, nom: m.nom, email: m.email, role: m.role, emailVerifie: m.emailVerifie, dateAjout: m.createdAt })),
  ].map((m) => ({ ...m, estActeur: String(m.id) === req.actorId }));

  res.json({ membres: tous, max: permissionsDe(proprietaire).plan === 'business' ? undefined : 1 });
});

exports.inviteMember = asyncHandler(async (req, res) => {
  const { nom, email: emailAddr, role } = req.body;
  if (!nom || !emailAddr) return res.status(400).json({ message: 'Nom et email requis.' });
  if (!['admin', 'collaborateur'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide (admin ou collaborateur).' });
  }

  const proprietaire = await User.findById(req.userId);
  const nbMembresActuel = await compterMembres(req.userId);
  if (!permissionsDe(proprietaire).peutAjouterUtilisateur(nbMembresActuel)) {
    return res.status(403).json({
      message: proprietaire.subscription === 'business'
        ? `Vous avez atteint la limite de membres de votre équipe (${nbMembresActuel}).`
        : "L'ajout de collaborateurs est réservé au plan Business.",
      code: 'FEATURE_LOCKED',
      feature: 'multiUtilisateurs',
    });
  }

  const emailNormalise = emailAddr.toLowerCase().trim();
  const existe = await User.findOne({ email: emailNormalise });
  if (existe) return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre compte.' });

  const code = genererCode();
  const codeHash = await bcrypt.hash(code, 10);
  const motDePasseTemporaire = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

  const membre = await User.create({
    nom: nom.trim(),
    email: emailNormalise,
    password: motDePasseTemporaire,
    emailVerifie: true,
    compteProprietaire: req.userId,
    role,
    codeResetPassword: codeHash,
    codeResetPasswordExpire: new Date(Date.now() + DUREE_CODE_MS),
  });

  try {
    await email.sendTeamInviteEmail({
      to: membre.email,
      nomInvite: membre.nom,
      nomInvitant: proprietaire.nom,
      entreprise: proprietaire.entreprise,
      code,
      roleLabel: ROLE_LABEL[role],
    });
  } catch (err) {
    console.error("Échec d'envoi de l'invitation :", err.message);
    return res.status(201).json({
      membre: { id: membre._id, nom: membre.nom, email: membre.email, role: membre.role },
      emailEnvoye: false,
      message: "Membre créé, mais l'email d'invitation n'a pas pu être envoyé. Il peut utiliser « Mot de passe oublié » avec son email pour définir son mot de passe.",
    });
  }

  await ActivityLog.create({
    owner: req.userId, acteur: req.actorId, acteurNom: req.actorNom,
    action: 'equipe.invitation', ressource: 'utilisateur', ressourceId: membre._id,
    details: `${membre.nom} (${ROLE_LABEL[role]}) invité(e)`,
  });

  res.status(201).json({
    membre: { id: membre._id, nom: membre.nom, email: membre.email, role: membre.role },
    emailEnvoye: true,
    message: 'Invitation envoyée.',
  });
});

exports.updateMemberRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'collaborateur'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide (admin ou collaborateur).' });
  }
  if (req.params.id === req.userId) {
    return res.status(400).json({ message: 'Le rôle du propriétaire ne peut pas être modifié.' });
  }
  const membre = await User.findOneAndUpdate(
    { _id: req.params.id, compteProprietaire: req.userId },
    { role },
    { new: true }
  ).select('nom email role');
  if (!membre) return res.status(404).json({ message: 'Membre introuvable' });
  res.json({ membre });
});

exports.removeMember = asyncHandler(async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ message: 'Le propriétaire ne peut pas se retirer lui-même.' });
  }
  const membre = await User.findOneAndDelete({ _id: req.params.id, compteProprietaire: req.userId });
  if (!membre) return res.status(404).json({ message: 'Membre introuvable' });

  await ActivityLog.create({
    owner: req.userId, acteur: req.actorId, acteurNom: req.actorNom,
    action: 'equipe.retrait', ressource: 'utilisateur', ressourceId: membre._id,
    details: `${membre.nom} retiré(e) de l'équipe`,
  });

  res.json({ message: 'Membre retiré.' });
});

exports.getActivite = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 30;
  const [items, total] = await Promise.all([
    ActivityLog.find({ owner: req.userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ActivityLog.countDocuments({ owner: req.userId }),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});
