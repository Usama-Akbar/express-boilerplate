'use strict';

const crypto = require('crypto');
const User = require('../models/user.model');
const { generateTokenPair, verifyRefreshToken } = require('../helpers/token.helper');
const { hashToken, generateOtp } = require('../utils/encryption.util');
const { cacheSet, cacheDel, cacheGet } = require('../config/redis');
const { sendEmail } = require('./email.service');
const AppError = require('../helpers/app-error.helper');
const logger = require('../config/logger');

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/api/v1/auth/refresh',
};

class AuthService {
  /**
   * Register a new user
   */
  async register(data) {
    const { firstName, lastName, email, password, organizationName } = data;

    // Check for existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw AppError.conflict('An account with this email already exists');
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      status: User.STATUSES.PENDING_VERIFICATION,
    });

    // Handle organization creation
    if (organizationName) {
      const Organization = require('../models/organization.model');
      const org = await Organization.create({
        name: organizationName,
        ownerId: user._id,
        members: [{ userId: user._id, role: 'owner' }],
      });
      user.organizationId = org._id;
      await user.save({ validateBeforeSave: false });
    }

    // Send verification email
    await this.sendVerificationEmail(user);

    logger.info(`New user registered: ${user.email}`);
    return user.toSafeObject();
  }

  /**
   * Login with email & password
   */
  async login(email, password, meta = {}) {
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password +twoFactorEnabled +twoFactorSecret');

    if (!user || !(await user.comparePassword(password))) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (user.status === User.STATUSES.SUSPENDED) {
      throw AppError.forbidden('Account has been suspended. Please contact support.');
    }

    if (user.status === User.STATUSES.PENDING_VERIFICATION) {
      throw AppError.forbidden('Please verify your email address before logging in.');
    }

    if (user.status !== User.STATUSES.ACTIVE) {
      throw AppError.forbidden(`Account is ${user.status}`);
    }

    // If 2FA enabled, return partial token requiring 2FA
    if (user.twoFactorEnabled) {
      const twoFactorToken = await this.generateTwoFactorChallenge(user._id);
      return { requiresTwoFactor: true, twoFactorToken };
    }

    return this.issueTokens(user, meta);
  }

  /**
   * Issue access + refresh tokens
   */
  async issueTokens(user, meta = {}) {
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString(),
    };

    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    // Store refresh token
    const hashedRefreshToken = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    user.refreshTokens = user.refreshTokens || [];
    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length >= 5) {
      user.refreshTokens = user.refreshTokens.slice(-4);
    }
    user.refreshTokens.push({
      token: hashedRefreshToken,
      device: meta.device,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt,
    });

    user.lastLoginAt = new Date();
    user.lastLoginIp = meta.ip;
    await user.save({ validateBeforeSave: false });

    // Cache user for performance
    await cacheSet(`user:${user._id}`, user.toSafeObject(), 300); // 5 min

    return {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    };
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    const hashedToken = hashToken(refreshToken);

    console.log("Decoded refresh token:", decoded);
    console.log("Hashed refresh token:", hashedToken);

    const user = await User.findOne({
      _id: decoded.userId,
      'refreshTokens.token': hashedToken,
    });

    if (!user) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const storedToken = user.refreshTokens.find((t) => t.token === hashedToken);
    if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
      throw AppError.unauthorized('Refresh token has expired');
    }

    // Rotate refresh token (remove old, issue new)
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== hashedToken);
    await user.save({ validateBeforeSave: false });

    return this.issueTokens(user);
  }

  /**
   * Logout - invalidate tokens
   */
  async logout(userId, accessTokenJti, refreshToken) {
    // Blacklist access token
    if (accessTokenJti) {
      await cacheSet(`blacklist:${accessTokenJti}`, 1, 60 * 15); // 15 min TTL
    }

    // Remove refresh token
    if (refreshToken) {
      const hashedToken = hashToken(refreshToken);
      await User.findByIdAndUpdate(userId, {
        $pull: { refreshTokens: { token: hashedToken } },
      });
    }

    // Clear user cache
    await cacheDel(`user:${userId}`);
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId) {
    await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
    await cacheDel(`user:${userId}`);
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(user) {
    const token = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      template: 'email-verification',
      context: {
        name: user.firstName,
        verificationUrl,
        expiresIn: '24 hours',
      },
    });
  }

  /**
   * Verify email address
   */
  async verifyEmail(token) {
    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      throw AppError.badRequest('Email verification token is invalid or has expired');
    }

    user.isEmailVerified = true;
    user.status = User.STATUSES.ACTIVE;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return user.toSafeObject();
  }

  /**
   * Request password reset
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether user exists
      return;
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password reset request',
        template: 'password-reset',
        context: {
          name: user.firstName,
          resetUrl,
          expiresIn: '10 minutes',
        },
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw AppError.internal('Failed to send password reset email');
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    const hashedToken = hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw AppError.badRequest('Password reset token is invalid or has expired');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    return user.toSafeObject();
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      throw AppError.unauthorized('Current password is incorrect');
    }

    user.password = newPassword;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();
    await cacheDel(`user:${userId}`);

    return user.toSafeObject();
  }

  /**
   * Generate 2FA challenge token
   */
  async generateTwoFactorChallenge(userId) {
    const challengeToken = crypto.randomBytes(32).toString('hex');
    await cacheSet(`2fa_challenge:${challengeToken}`, userId.toString(), 300); // 5 min
    return challengeToken;
  }

  /**
   * Verify 2FA OTP
   */
  async verifyTwoFactor(challengeToken, otp) {
    const speakeasy = require('speakeasy');
    const userId = await cacheGet(`2fa_challenge:${challengeToken}`);
    if (!userId) throw AppError.unauthorized('2FA challenge expired or invalid');

    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) throw AppError.notFound('User not found');

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: otp,
      window: 1,
    });

    if (!isValid) throw AppError.unauthorized('Invalid 2FA code');

    await cacheDel(`2fa_challenge:${challengeToken}`);
    return this.issueTokens(user);
  }
}

module.exports = new AuthService();
