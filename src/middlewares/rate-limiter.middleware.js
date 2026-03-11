'use strict';

const rateLimit = require('express-rate-limit');
const AppError = require('../helpers/app-error.helper');

const createLimiter = (options = {}) =>
  rateLimit({
    windowMs: options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: options.max || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID for authenticated requests, IP for public
      return req.user?.id || req.ip;
    },
    handler: (req, res, next) => {
      next(AppError.tooManyRequests('Rate limit exceeded. Please try again later.'));
    },
    skip: (req) => process.env.NODE_ENV === 'test',
    ...options,
  });

// ─── General rate limiter ─────────────────────────────────────────────────────
const rateLimiter = createLimiter();

// ─── Strict rate limiter for auth endpoints ───────────────────────────────────
const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
});

// ─── Password reset (very strict) ────────────────────────────────────────────
const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
});

// ─── API key rate limiter ─────────────────────────────────────────────────────
const apiKeyRateLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
});

module.exports = {
  rateLimiter,
  authRateLimiter,
  passwordResetLimiter,
  apiKeyRateLimiter,
  createLimiter,
};
