const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  type: { type: String, enum: ['user', 'admin'], required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  adminEmail: { type: String, default: null, lowercase: true, trim: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null, index: true },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  createdIp: { type: String, default: '' },
  lastIp: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Nettoyage automatique des sessions expirées.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
