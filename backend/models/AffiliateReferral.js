const mongoose = require('mongoose');

const affiliateReferralSchema = new mongoose.Schema({
  affiliate: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateProfile', required: true, index: true },
  referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  code: { type: String, required: true, uppercase: true, index: true },
  status: { type: String, enum: ['pending_email', 'active', 'converted', 'cancelled'], default: 'pending_email', index: true },
  discountMonthsApplied: { type: Number, default: 0, min: 0, max: 3 },
  totalCommission: { type: Number, default: 0, min: 0 },
  firstSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  lastSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  convertedAt: { type: Date, default: null },
}, { timestamps: true });

affiliateReferralSchema.index({ affiliate: 1, createdAt: -1 });

module.exports = mongoose.model('AffiliateReferral', affiliateReferralSchema);
