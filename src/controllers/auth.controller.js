'use strict';

const authService = require('../services/auth.service');
const ApiResponse = require('../helpers/api-response.helper');

class AuthController {
  async register(req, res) {
    const user = await authService.register(req.body);
    return ApiResponse.created(res, { user }, 'Registration successful. Please verify your email.');
  }

  async login(req, res) {
    const { email, password } = req.body;
    const meta = { ip: req.ip, userAgent: req.get('user-agent'), device: req.get('x-device') };

    const result = await authService.login(email, password, meta);

    if (result.requiresTwoFactor) {
      return ApiResponse.success(res, result, 'Two-factor authentication required', 200);
    }

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return ApiResponse.success(res, {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    }, 'Login successful');
  }

  async refresh(req, res) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return ApiResponse.error(res, 'Refresh token required', 401, 'REFRESH_TOKEN_MISSING');
    }

    const result = await authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return ApiResponse.success(res, {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    }, 'Token refreshed');
  }

  async logout(req, res) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(req.user._id, req.tokenPayload?.jti, refreshToken);
    res.clearCookie('refreshToken');
    return ApiResponse.success(res, null, 'Logged out successfully');
  }

  async logoutAll(req, res) {
    await authService.logoutAll(req.user._id);
    res.clearCookie('refreshToken');
    return ApiResponse.success(res, null, 'Logged out from all devices');
  }

  async forgotPassword(req, res) {
    await authService.forgotPassword(req.body.email);
    // Always return success to avoid email enumeration
    return ApiResponse.success(res, null, 'If that email exists, a reset link has been sent.');
  }

  async resetPassword(req, res) {
    const { token } = req.params;
    const { password } = req.body;
    const user = await authService.resetPassword(token, password);
    return ApiResponse.success(res, { user }, 'Password reset successfully');
  }

  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    const user = await authService.changePassword(req.user._id, currentPassword, newPassword);
    return ApiResponse.success(res, { user }, 'Password changed successfully');
  }

  async verifyEmail(req, res) {
    const user = await authService.verifyEmail(req.params.token);
    return ApiResponse.success(res, { user }, 'Email verified successfully');
  }

  async resendVerification(req, res) {
    const User = require('../models/user.model');
    const user = await User.findById(req.user._id);
    await authService.sendVerificationEmail(user);
    return ApiResponse.success(res, null, 'Verification email sent');
  }

  async verifyTwoFactor(req, res) {
    const { challengeToken, otp } = req.body;
    const result = await authService.verifyTwoFactor(challengeToken, otp);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return ApiResponse.success(res, {
      accessToken: result.accessToken,
      user: result.user,
    }, '2FA verification successful');
  }

  async getMe(req, res) {
    return ApiResponse.success(res, { user: req.user.toSafeObject ? req.user.toSafeObject() : req.user }, 'Profile fetched');
  }
}

module.exports = new AuthController();
