const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Wrapper pour capturer les erreurs async sans try/catch partout
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const publicUser = (user) => ({
  id: user._id,
  nom: user.nom,
  entreprise: user.entreprise,
  email: user.email,
  telephone: user.telephone,
  adresse: user.adresse,
  logoUrl: user.logoUrl,
  devise: user.devise,
  subscription: user.subscription,
});

exports.register = asyncHandler(async (req, res) => {
  const { nom, email, password, entreprise } = req.body;
  if (!nom || !email || !password) {
    return res.status(400).json({ message: 'Nom, email et mot de passe requis' });
  }
  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) return res.status(400).json({ message: 'Email déjà utilisé' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    nom: nom.trim(),
    email: email.toLowerCase().trim(),
    password: hashed,
    entreprise: entreprise || ''
  });
  const token = signToken(user._id);
  res.status(201).json({ token, user: publicUser(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return res.status(400).json({ message: 'Identifiants invalides' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: 'Identifiants invalides' });

  const token = signToken(user._id);
  res.json({ token, user: publicUser(user) });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('-password');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(publicUser(user));
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['nom', 'entreprise', 'telephone', 'adresse', 'logoUrl', 'devise'];
  const updates = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });
  const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(publicUser(user));
});
