const mongoose = require('mongoose');

const affiliateProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  active: { type: Boolean, default: true, index: true },
  activatedAt: { type: Date, default: Date.now },
  clicks: { type: Number, default: 0, min: 0 },
  signups: { type: Number, default: 0, min: 0 },
  paidReferrals: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('AffiliateProfile', affiliateProfileSchema);
