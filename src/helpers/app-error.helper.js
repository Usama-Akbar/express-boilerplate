'use strict';

/**
 * Custom application error class with HTTP status codes and error codes.
 * All operational errors should use this class.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {string} errorCode - Machine-readable error code
   * @param {Array} errors - Additional validation errors
   */
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', errors = []) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = true; // operational errors are expected/handled
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  // ─── Factory methods ─────────────────────────────────────────────────────

  static badRequest(message, errors = []) {
    return new AppError(message, 400, 'BAD_REQUEST', errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Access denied') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message) {
    return new AppError(message, 409, 'CONFLICT');
  }

  static unprocessable(message, errors = []) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', errors);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }

  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  toJSON() {
    return {
      success: false,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
      errors: this.errors,
      timestamp: this.timestamp,
    };
  }
}

module.exports = AppError;
