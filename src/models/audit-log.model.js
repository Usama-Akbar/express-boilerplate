'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['auth', 'user', 'organization', 'billing', 'data', 'admin', 'system'],
      required: true,
      index: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: String,
    actorRole: String,
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetType: String,
    targetEmail: String,
    description: String,
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },
    metadata: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
    requestId: String,
    status: {
      type: String,
      enum: ['success', 'failure', 'warning'],
      default: 'success',
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
  },
  {
    timestamps: true,
    // Audit logs are write-once — never update them
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, category: 1, createdAt: -1 });

// TTL: Auto-delete logs older than 1 year
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

auditLogSchema.plugin(mongoosePaginate);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
