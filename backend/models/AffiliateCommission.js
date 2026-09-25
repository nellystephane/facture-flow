const mongoose = require('mongoose');

const affiliateCommissionSchema = new mongoose.Schema({
  affiliate: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateProfile', required: true, index: true },
  referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referral: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateReferral', required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, unique: true, index: true },
  plan: { type: String, enum: ['pro', 'business'], required: true },
  montant: { type: Number, required: true, min: 0 },
  statut: { type: String, enum: ['creditee', 'annulee'], default: 'creditee', index: true },
  walletEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletEntry', default: null },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

affiliateCommissionSchema.index({ affiliate: 1, createdAt: -1 });

module.exports = mongoose.model('AffiliateCommission', affiliateCommissionSchema);
