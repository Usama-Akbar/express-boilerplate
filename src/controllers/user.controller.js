'use strict';

const User = require('../models/user.model');
const ApiResponse = require('../helpers/api-response.helper');
const AppError = require('../helpers/app-error.helper');
const { buildPaginateOptions } = require('../helpers/pagination.helper');
const storageService = require('../services/storage.service');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { pickFields, omitFields } = require('../utils/helpers.util');

const UPDATABLE_FIELDS = ['firstName', 'lastName', 'phone', 'preferences', 'username'];

class UserController {
  async getUsers(req, res) {
    const options = buildPaginateOptions(req.query);
    const filter = { deletedAt: null };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.organizationId) filter.organizationId = req.query.organizationId;
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const result = await User.paginate(filter, {
      ...options,
      select: '-password -passwordResetToken -emailVerificationToken -refreshTokens -twoFactorSecret',
    });

    return ApiResponse.paginated(res, result.docs, result, 'Users retrieved');
  }

  async getUserById(req, res) {
    const cacheKey = `user_profile:${req.params.id}`;
    let user = await cacheGet(cacheKey);
    if (!user) {
     const user = await User.findOne({ _id: req.params.id, deletedAt: null })
        .select('-password -passwordResetToken -emailVerificationToken -refreshTokens.token -twoFactorSecret')
        .populate('organizationId', 'name slug logo');
      if (!user) throw AppError.notFound('User not found');
      await cacheSet(cacheKey, user, 300);
    }
    return ApiResponse.success(res, { user }, 'User retrieved');
  }

  async getMe(req, res) {
    req.params.id = req.user._id.toString();
    return this.getUserById(req, res);
  }

  async updateUser(req, res) {
    const updateData = pickFields(req.body, UPDATABLE_FIELDS);

    // Ensure uniqueness of username if being updated
    if (updateData.username) {
      const existing = await User.findOne({
        username: updateData.username,
        _id: { $ne: req.params.id },
      });
      if (existing) throw AppError.conflict('Username already taken');
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -refreshTokens.token -twoFactorSecret');

    if (!user) throw AppError.notFound('User not found');

    await cacheDel(`user_profile:${req.params.id}`);
    await cacheDel(`user:${req.params.id}`);

    return ApiResponse.success(res, { user }, 'User updated');
  }

  async updateMe(req, res) {
    req.params.id = req.user._id.toString();
    return this.updateUser(req, res);
  }

  async uploadAvatar(req, res) {
    if (!req.file) throw AppError.badRequest('No file uploaded');

    const urls = await storageService.uploadAvatar(req.file.buffer, req.user._id);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: urls.original },
      { new: true }
    ).select('avatar firstName lastName');

    await cacheDel(`user_profile:${req.user._id}`);
    await cacheDel(`user:${req.user._id}`);

    return ApiResponse.success(res, { user, urls }, 'Avatar uploaded');
  }

  async deleteUser(req, res) {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: req.user._id,
          status: User.STATUSES.INACTIVE,
        },
      },
      { new: true }
    );

    if (!user) throw AppError.notFound('User not found');

    await cacheDel(`user_profile:${req.params.id}`);
    await cacheDel(`user:${req.params.id}`);

    return ApiResponse.noContent(res);
  }

  async deleteMe(req, res) {
    req.params.id = req.user._id.toString();
    return this.deleteUser(req, res);
  }

  async getUserSessions(req, res) {
    const user = await User.findById(req.user._id).select('+refreshTokens');
    const sessions = (user.refreshTokens || []).map(({ device, ip, userAgent, createdAt, expiresAt }) => ({
      device,
      ip,
      userAgent,
      createdAt,
      expiresAt,
    }));
    return ApiResponse.success(res, { sessions }, 'Sessions retrieved');
  }

  async updatePreferences(req, res) {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { preferences: req.body } },
      { new: true, runValidators: true }
    ).select('preferences');

    await cacheDel(`user:${req.user._id}`);

    return ApiResponse.success(res, { preferences: user.preferences }, 'Preferences updated');
  }
}

module.exports = new UserController();
