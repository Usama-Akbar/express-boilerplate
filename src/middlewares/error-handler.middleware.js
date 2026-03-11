'use strict';

const mongoose = require('mongoose');
const AppError = require('../helpers/app-error.helper');
const logger = require('../config/logger');

/**
 * Transform known library errors into AppErrors
 */
function normalizeError(err) {
  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
    return new AppError('Validation failed', 422, 'VALIDATION_ERROR', errors);
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const value = err.keyValue?.[field];
    return new AppError(
      `${field} '${value}' already exists`,
      409,
      'DUPLICATE_KEY_ERROR',
      [{ field, message: `${field} must be unique` }]
    );
  }

  // Mongoose Cast Error (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');
  }

  // JWT Errors (handled in token helper, but just in case)
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, 'TOKEN_INVALID');
  }

  if (err.name === 'TokenExpiredError') {
    return new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
  }

  // Multer Errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File size too large', 413, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400, 'UNEXPECTED_FILE');
  }

  // Stripe Errors
  if (err.type && err.type.startsWith('Stripe')) {
    return new AppError(err.message || 'Payment processing error', 402, 'PAYMENT_ERROR');
  }

  return err;
}

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  let error = normalizeError(err);

  // Default to 500 if not an AppError
  if (!(error instanceof AppError)) {
    const statusCode = error.statusCode || 500;
    error = new AppError(
      process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
      statusCode,
      'INTERNAL_ERROR'
    );
    error.originalError = err;
  }

  // Log errors
  const logMeta = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    ip: req.ip,
  };

  if (error.statusCode >= 500) {
    logger.error(error.message, { ...logMeta, stack: err.stack });
  } else if (error.statusCode >= 400) {
    logger.warn(error.message, logMeta);
  }

  const response = {
    success: false,
    message: error.message,
    errorCode: error.errorCode,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  };

  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
}

module.exports = { errorHandler };
