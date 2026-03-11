'use strict';

const Joi = require('joi');

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .message('Password must be at least 8 characters and contain uppercase, lowercase, and a number');

const register = Joi.object({
  firstName: Joi.string().trim().min(1).max(50).required(),
  lastName: Joi.string().trim().min(1).max(50).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: passwordSchema.required(),
  organizationName: Joi.string().trim().min(2).max(100).optional(),
});

const login = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

const resetPassword = Joi.object({
  password: passwordSchema.required(),
  passwordConfirm: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema.required(),
  newPasswordConfirm: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

const verifyTwoFactor = Joi.object({
  challengeToken: Joi.string().required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyTwoFactor,
};
