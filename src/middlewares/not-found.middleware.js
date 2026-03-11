'use strict';

const { v4: uuidv4 } = require('uuid');
const AppError = require('../helpers/app-error.helper');
const logger = require('../config/logger');

// ─── Request ID Middleware ────────────────────────────────────────────────────
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

// ─── Request Logger Middleware ────────────────────────────────────────────────
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) logger.error('Request completed', logData);
    else if (res.statusCode >= 400) logger.warn('Request completed', logData);
    else logger.debug('Request completed', logData);
  });

  next();
}

// ─── Not Found Handler ────────────────────────────────────────────────────────
function notFoundHandler(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND'));
}

// ─── Security Headers ─────────────────────────────────────────────────────────
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
}

// ─── Validate MongoDB ObjectId ────────────────────────────────────────────────
const mongoose = require('mongoose');

function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid ${paramName} format`, 400, 'INVALID_ID'));
    }
    next();
  };
}

// ─── Validate Request Schema (Joi) ────────────────────────────────────────────
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/["]/g, ''),
        type: d.type,
      }));
      return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', errors));
    }

    req[target] = value;
    next();
  };
}

// ─── Audit middleware ─────────────────────────────────────────────────────────
function audit(action, category, options = {}) {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode < 400) {
        try {
          const AuditLog = require('../models/audit-log.model');
          await AuditLog.create({
            action,
            category,
            actorId: req.user?._id,
            actorEmail: req.user?.email,
            actorRole: req.user?.role,
            organizationId: req.organization?._id || req.user?.organizationId,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            requestId: req.id,
            status: res.statusCode < 400 ? 'success' : 'failure',
            ...options,
          });
        } catch (err) {
          logger.error('Audit log creation failed:', err.message);
        }
      }
    });
    next();
  };
}

module.exports = {
  requestId,
  requestLogger,
  notFoundHandler,
  securityHeaders,
  validateObjectId,
  validate,
  audit,
};
