const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const asyncHandler = require('../middleware/asyncHandler');
const { paginationParams, paginatedResponse } = require('../utils/pagination');

function debutMoisBenin(now = new Date()) {
  // UTC+1 sans heure d'été : le mois local commence à 23h UTC la veille.
  const l = new Date(now.getTime() + 3600000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - 3600000);
}

exports.getExpenses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { owner: req.userId };
  if (req.query.categorie) filter.categorie = String(req.query.categorie);
  if (req.query.q) {
    const re = new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ libelle: re }, { fournisseur: re }];
  }
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    filter.date = {};
    if (from && !Number.isNaN(from.getTime())) filter.date.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filter.date.$lte = to;
  }
  const [items, total] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
    Expense.countDocuments(filter),
  ]);
  res.json(paginatedResponse(items, total, page, limit));
});

// Résumé affiché en haut de la page Dépenses (mois en cours, total, répartition).
exports.getExpensesSummary = asyncHandler(async (req, res) => {
  const owner = new mongoose.Types.ObjectId(req.userId);
  const debutMois = debutMoisBenin();
  const [mois, total, parCategorie] = await Promise.all([
    Expense.aggregate([{ $match: { owner, date: { $gte: debutMois } } }, { $group: { _id: null, total: { $sum: '$montant' }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: { owner } }, { $group: { _id: null, total: { $sum: '$montant' }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: { owner, date: { $gte: debutMois } } }, { $group: { _id: '$categorie', total: { $sum: '$montant' } } }, { $sort: { total: -1 } }]),
  ]);
  res.json({
    totalMois: Math.round(mois[0]?.total || 0),
    nombreMois: mois[0]?.count || 0,
    totalGlobal: Math.round(total[0]?.total || 0),
    nombreGlobal: total[0]?.count || 0,
    categoriePrincipaleMois: parCategorie[0]?._id || null,
  });
});

exports.createExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.create({ ...req.body, owner: req.userId, createdBy: req.actorId || null });
  res.status(201).json(expense);
});

exports.updateExpense = asyncHandler(async (req, res) => {
  const allowed = ['libelle', 'montant', 'categorie', 'date', 'fournisseur', 'methode', 'note'];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const expense = await Expense.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, updates, { returnDocument: 'after', runValidators: true });
  if (!expense) return res.status(404).json({ message: 'Dépense introuvable' });
  res.json(expense);
});

exports.deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!expense) return res.status(404).json({ message: 'Dépense introuvable' });
  res.json({ message: 'Dépense supprimée' });
});
