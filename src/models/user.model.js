'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const mongoosePaginate = require('mongoose-paginate-v2');
const crypto = require('crypto');

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
};

const STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING_VERIFICATION: 'pending_verification',
};

const userSchema = new mongoose.Schema(
  {
    // ─── Identity ───────────────────────────────────────────────────────────
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
      index: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    avatar: { type: String, default: null },
    phone: { type: String, trim: true, default: null },

    // ─── Authentication ──────────────────────────────────────────────────────
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    passwordChangedAt: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // ─── OAuth ──────────────────────────────────────────────────────────────
    oauthProviders: [
      {
        provider: { type: String, enum: ['google', 'github', 'facebook'] },
        providerId: String,
        accessToken: { type: String, select: false },
        refreshToken: { type: String, select: false },
      },
    ],

    // ─── 2FA ────────────────────────────────────────────────────────────────
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorBackupCodes: { type: [String], select: false },

    // ─── Authorization ──────────────────────────────────────────────────────
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    permissions: [{ type: String }],

    // ─── Organization ────────────────────────────────────────────────────────
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },

    // ─── Status ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(STATUSES),
      default: STATUSES.PENDING_VERIFICATION,
      index: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // ─── Session Management ──────────────────────────────────────────────────
    refreshTokens: [
      {
        token: { type: String, select: false },
        device: String,
        ip: String,
        userAgent: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date,
      },
    ],
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },

    // ─── Preferences ────────────────────────────────────────────────────────
    preferences: {
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
    },

    // ─── Metadata ───────────────────────────────────────────────────────────
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ email: 1, status: 1 });
userSchema.index({ organizationId: 1, role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ deletedAt: 1 }, { sparse: true });

// ─── Virtuals ────────────────────────────────────────────────────────────────
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isActive').get(function () {
  return this.status === STATUSES.ACTIVE && !this.deletedAt;
});

// ─── Pre-save Hooks ──────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const SALT_ROUNDS = 12;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ─── Instance Methods ────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.twoFactorSecret;
  delete obj.twoFactorBackupCodes;
  delete obj.refreshTokens;
  delete obj.oauthProviders;
  delete obj.__v;
  return obj;
};

// ─── Static Methods ──────────────────────────────────────────────────────────
userSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, status: STATUSES.ACTIVE, deletedAt: null });
};

userSchema.statics.ROLES = ROLES;
userSchema.statics.STATUSES = STATUSES;

// ─── Query Helpers ───────────────────────────────────────────────────────────
userSchema.query.notDeleted = function () {
  return this.where({ deletedAt: null });
};

userSchema.query.active = function () {
  return this.where({ status: STATUSES.ACTIVE, deletedAt: null });
};

// ─── Plugins ─────────────────────────────────────────────────────────────────
userSchema.plugin(mongoosePaginate);

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.STATUSES = STATUSES;
