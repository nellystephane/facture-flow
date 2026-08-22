const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const email = require('../utils/email');

const asyncHandler = require('../middleware/asyncHandler');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Un compte "collaborateur" (plan Business, voir models/User.js) n'a pas sa
// propre entreprise/logo/abonnement : ceux-ci sont ceux de son propriétaire.
// On résout toujours les deux ensemble pour construire une réponse cohérente.
async function resoudreEspace(acteur) {
  if (!acteur.compteProprietaire) return { acteur, proprietaire: acteur };
  const proprietaire = await User.findById(acteur.compteProprietaire);
  return { acteur, proprietaire: proprietaire || acteur };
}

// Fusionne identité personnelle (acteur) + profil d'entreprise/abonnement
// (propriétaire de l'espace de travail) dans la forme renvoyée au frontend.
function profilReponse({ acteur, proprietaire }) {
  return {
    id: acteur._id,
    nom: acteur.nom,
    email: acteur.email,
    emailVerifie: acteur.emailVerifie,
    role: acteur.role,
    estCollaborateur: !!acteur.compteProprietaire,
    entreprise: proprietaire.entreprise,
    telephone: proprietaire.telephone,
    adresse: proprietaire.adresse,
    logoUrl: proprietaire.logoUrl,
    devise: proprietaire.devise,
    banque: proprietaire.banque,
    subscription: proprietaire.subscription,
    abonnement: proprietaire.abonnement,
    estPremium: proprietaire.estPremium,
  };
}

async function reponseAuth(user) {
  const espace = await resoudreEspace(user);
  return profilReponse(espace);
}

const DUREE_CODE_MS = 15 * 60 * 1000; // 15 minutes

function genererCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Exigences : au moins 8 caractères + au moins un caractère spécial.
function erreurMotDePasse(password) {
  if (!password || password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un caractère spécial (ex: ! ? # @ % &).';
  }
  return null;
}

exports.register = asyncHandler(async (req, res) => {
  const { nom, email: emailAddr, password, entreprise } = req.body;
  if (!nom || !emailAddr || !password) {
    return res.status(400).json({ message: 'Nom, email et mot de passe requis' });
  }

  const erreurPassword = erreurMotDePasse(password);
  if (erreurPassword) return res.status(400).json({ message: erreurPassword });

  const emailNormalise = emailAddr.toLowerCase().trim();
  const exists = await User.findOne({ email: emailNormalise });
  if (exists) return res.status(400).json({ message: 'Email déjà utilisé' });

  const hashed = await bcrypt.hash(password, 10);
  const code = genererCode();
  const codeHash = await bcrypt.hash(code, 10);

  const user = await User.create({
    nom: nom.trim(),
    email: emailNormalise,
    password: hashed,
    entreprise: entreprise || '',
    emailVerifie: false,
    codeVerification: codeHash,
    codeVerificationExpire: new Date(Date.now() + DUREE_CODE_MS),
  });

  let emailEnvoye = true;
  try {
    await email.sendVerificationCode({ to: user.email, nom: user.nom, code });
  } catch (err) {
    emailEnvoye = false;
    console.error("Échec d'envoi du code de vérification:", err.message);
  }

  res.status(201).json({
    needsVerification: true,
    email: user.email,
    emailEnvoye,
    message: emailEnvoye
      ? 'Un code de confirmation à 6 chiffres a été envoyé à votre adresse email.'
      : "Compte créé, mais l'envoi automatique de l'email a échoué. Vous pouvez demander un nouveau code.",
  });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const { email: emailAddr, code } = req.body;
  if (!emailAddr || !code) return res.status(400).json({ message: 'Email et code requis' });

  const user = await User.findOne({ email: emailAddr.toLowerCase().trim() })
    .select('+codeVerification +codeVerificationExpire');
  if (!user) return res.status(400).json({ message: 'Compte introuvable' });

  if (user.emailVerifie) {
    const token = signToken(user._id);
    return res.json({ token, user: await reponseAuth(user) });
  }

  if (!user.codeVerification || !user.codeVerificationExpire || user.codeVerificationExpire < new Date()) {
    return res.status(400).json({ message: 'Ce code a expiré. Demandez-en un nouveau.', code: 'CODE_EXPIRE' });
  }

  const match = await bcrypt.compare(code, user.codeVerification);
  if (!match) return res.status(400).json({ message: 'Code incorrect.' });

  user.emailVerifie = true;
  user.codeVerification = null;
  user.codeVerificationExpire = null;
  await user.save();

  const token = signToken(user._id);
  res.json({ token, user: await reponseAuth(user) });
});

exports.resendVerificationCode = asyncHandler(async (req, res) => {
  const { email: emailAddr } = req.body;
  if (!emailAddr) return res.status(400).json({ message: 'Email requis' });

  const user = await User.findOne({ email: emailAddr.toLowerCase().trim() });
  if (!user) return res.status(400).json({ message: 'Compte introuvable' });
  if (user.emailVerifie) return res.status(400).json({ message: 'Cet email est déjà vérifié.' });

  const code = genererCode();
  user.codeVerification = await bcrypt.hash(code, 10);
  user.codeVerificationExpire = new Date(Date.now() + DUREE_CODE_MS);
  await user.save();

  try {
    await email.sendVerificationCode({ to: user.email, nom: user.nom, code });
  } catch (err) {
    if (err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        message: "L'envoi d'email n'est pas configuré côté serveur (variables BREVO_SMTP_* manquantes).",
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }
    return res.status(502).json({ message: "Échec de l'envoi de l'email : " + err.message });
  }

  res.json({ message: 'Un nouveau code vous a été envoyé.' });
});

exports.login = asyncHandler(async (req, res) => {
  const { email: emailAddr, password } = req.body;
  if (!emailAddr || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }
  const user = await User.findOne({ email: emailAddr.toLowerCase().trim() });
  if (!user) return res.status(400).json({ message: 'Identifiants invalides' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: 'Identifiants invalides' });

  const token = signToken(user._id);
  res.json({ token, user: await reponseAuth(user) });
});

const MESSAGE_GENERIQUE_OUBLI =
  'Si un compte existe avec cet email, un code de réinitialisation a été envoyé.';

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email: emailAddr } = req.body;
  if (!emailAddr) return res.status(400).json({ message: 'Email requis' });

  const user = await User.findOne({ email: emailAddr.toLowerCase().trim() });
  if (!user) return res.json({ message: MESSAGE_GENERIQUE_OUBLI });

  const code = genererCode();
  user.codeResetPassword = await bcrypt.hash(code, 10);
  user.codeResetPasswordExpire = new Date(Date.now() + DUREE_CODE_MS);
  await user.save();

  try {
    await email.sendPasswordResetCode({ to: user.email, nom: user.nom, code });
  } catch (err) {
    console.error('Échec envoi code réinitialisation:', err.message);
  }

  res.json({ message: MESSAGE_GENERIQUE_OUBLI });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email: emailAddr, code, password } = req.body;
  if (!emailAddr || !code || !password) {
    return res.status(400).json({ message: 'Email, code et nouveau mot de passe requis' });
  }
  const erreurPassword = erreurMotDePasse(password);
  if (erreurPassword) return res.status(400).json({ message: erreurPassword });

  const user = await User.findOne({ email: emailAddr.toLowerCase().trim() })
    .select('+codeResetPassword +codeResetPasswordExpire');
  if (!user || !user.codeResetPassword || !user.codeResetPasswordExpire || user.codeResetPasswordExpire < new Date()) {
    return res.status(400).json({ message: 'Code invalide ou expiré. Recommencez la demande.', code: 'CODE_EXPIRE' });
  }

  const match = await bcrypt.compare(code, user.codeResetPassword);
  if (!match) return res.status(400).json({ message: 'Code incorrect.' });

  user.password = await bcrypt.hash(password, 10);
  user.codeResetPassword = null;
  user.codeResetPasswordExpire = null;
  await user.save();

  const token = signToken(user._id);
  res.json({ token, user: await reponseAuth(user), message: 'Mot de passe réinitialisé.' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const acteur = await User.findById(req.actorId).select('-password');
  if (!acteur) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const proprietaire = req.actorId === req.userId ? acteur : await User.findById(req.userId).select('-password');
  res.json(profilReponse({ acteur, proprietaire: proprietaire || acteur }));
});

exports.updateProfile = asyncHandler(async (req, res) => {
  if (req.body.nom !== undefined) {
    await User.findByIdAndUpdate(req.actorId, { nom: req.body.nom });
  }

  const champsEntreprise = ['entreprise', 'telephone', 'adresse', 'devise', 'banque'];
  const updatesEntreprise = {};
  champsEntreprise.forEach((f) => {
    if (req.body[f] !== undefined) updatesEntreprise[f] = req.body[f];
  });
  if (Object.keys(updatesEntreprise).length > 0) {
    await User.findByIdAndUpdate(req.userId, updatesEntreprise);
  }

  const acteur = await User.findById(req.actorId).select('-password');
  const proprietaire = req.actorId === req.userId ? acteur : await User.findById(req.userId).select('-password');
  if (!acteur) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(profilReponse({ acteur, proprietaire: proprietaire || acteur }));
});

const MAX_LOGO_BYTES = 900 * 1024;

exports.uploadLogo = asyncHandler(async (req, res) => {
  const { logoBase64 } = req.body;
  const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i.exec(logoBase64 || '');
  if (!match) {
    return res.status(400).json({ message: 'Format d\'image invalide. Utilisez un PNG ou un JPG.' });
  }
  const raw = Buffer.from(match[2], 'base64');
  if (raw.length === 0) {
    return res.status(400).json({ message: 'Image vide ou illisible.' });
  }
  if (raw.length > MAX_LOGO_BYTES) {
    return res.status(400).json({
      message: `Image trop lourde (${Math.round(raw.length / 1024)} Ko). Maximum autorisé : ${MAX_LOGO_BYTES / 1024} Ko — essayez de la compresser.`,
    });
  }
  const proprietaire = await User.findByIdAndUpdate(req.userId, { logoUrl: logoBase64 }, { new: true }).select('-password');
  if (!proprietaire) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const acteur = req.actorId === req.userId ? proprietaire : await User.findById(req.actorId).select('-password');
  res.json(profilReponse({ acteur: acteur || proprietaire, proprietaire }));
});

exports.removeLogo = asyncHandler(async (req, res) => {
  const proprietaire = await User.findByIdAndUpdate(req.userId, { logoUrl: '' }, { new: true }).select('-password');
  if (!proprietaire) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const acteur = req.actorId === req.userId ? proprietaire : await User.findById(req.actorId).select('-password');
  res.json(profilReponse({ acteur: acteur || proprietaire, proprietaire }));
});

module.exports.resoudreEspace = resoudreEspace;
module.exports.profilReponse = profilReponse;
