const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema({
  scope: { type: String, enum: ['user', 'admin', 'system'], required: true, index: true },
  type: { type: String, required: true, index: true },
  identifier: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  details: { type: String, default: '' },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
}, { timestamps: true });

securityEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
