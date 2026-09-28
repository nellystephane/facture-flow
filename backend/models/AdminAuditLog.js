const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema({
  adminEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  action: { type: String, required: true, index: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  status: { type: Number, default: null },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  success: { type: Boolean, default: true },
  details: { type: String, default: '' },
}, { timestamps: true });

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
