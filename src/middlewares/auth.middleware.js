'use strict';

const { verifyAccessToken, extractTokenFromHeader } = require('../helpers/token.helper');
const User = require('../models/user.model');
const AppError = require('../helpers/app-error.helper');
const { cacheGet } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Main authentication middleware
 * Verifies JWT access token and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    const decoded = verifyAccessToken(token);

    // Check token blacklist (logged out tokens)
    const isBlacklisted = await cacheGet(`blacklist:${decoded.jti}`);
    if (isBlacklisted) {
      throw AppError.unauthorized('Token has been invalidated');
    }

    // Fetch user from DB (or cache)
    let user = await cacheGet(`user:${decoded.userId}`);
    if (!user) {
      user = await User.findById(decoded.userId).select('+passwordChangedAt');
      if (!user) throw AppError.unauthorized('User no longer exists');
    }

    // Check if user changed password after token was issued
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      throw AppError.unauthorized('Password was recently changed. Please log in again.');
    }

    // Check user status
    if (user.status !== User.STATUSES.ACTIVE) {
      throw AppError.forbidden(`Account is ${user.status}. Please contact support.`);
    }

    // Attach to request
    req.user = user;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - attaches user if token present, but doesn't fail if not
 */
async function optionalAuth(req, res, next) {
  try {
    if (!req.headers.authorization) return next();
    await authenticate(req, res, next);
  } catch {
    next(); // Silently continue
  }
}

/**
 * API Key authentication for server-to-server calls
 */
async function apiKeyAuth(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) throw AppError.unauthorized('API key required');

    const { hashToken } = require('../utils/encryption.util');
    const hashedKey = hashToken(apiKey);

    // Find org/user by API key hash
    const Organization = require('../models/organization.model');
    const org = await Organization.findOne({
      'apiKeys.keyHash': hashedKey,
      'apiKeys.isActive': true,
    });

    if (!org) throw AppError.unauthorized('Invalid API key');

    req.organization = org;
    req.isApiKeyAuth = true;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-based access control middleware
 * Usage: authorize('admin', 'super_admin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied: User ${req.user.id} (${req.user.role}) attempted to access resource requiring ${roles.join(', ')}`);
      return next(AppError.forbidden(`Access restricted to: ${roles.join(', ')}`));
    }

    next();
  };
}

/**
 * Organization membership middleware
 */
async function requireOrganization(req, res, next) {
  try {
    const orgId = req.params.orgId || req.headers['x-organization-id'] || req.user?.organizationId;
    if (!orgId) throw AppError.badRequest('Organization ID required');

    const Organization = require('../models/organization.model');
    const org = await Organization.findOne({ _id: orgId, isActive: true, deletedAt: null });
    if (!org) throw AppError.notFound('Organization not found');

    // Verify membership
    if (!org.hasMember(req.user._id) && req.user.role !== User.ROLES.SUPER_ADMIN) {
      throw AppError.forbidden('You are not a member of this organization');
    }

    req.organization = org;
    req.orgRole = org.getMemberRole(req.user._id);

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Verify email verification status
 */
function requireEmailVerification(req, res, next) {
  if (!req.user?.isEmailVerified) {
    return next(AppError.forbidden('Please verify your email address first'));
  }
  next();
}

/**
 * Require 2FA if enabled on account
 */
function require2FA(req, res, next) {
  if (req.user?.twoFactorEnabled && !req.tokenPayload?.twoFactorVerified) {
    return next(AppError.forbidden('Two-factor authentication required'));
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  apiKeyAuth,
  authorize,
  requireOrganization,
  requireEmailVerification,
  require2FA,
};
