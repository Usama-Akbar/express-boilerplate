'use strict';

/**
 * Standardized API response helpers.
 * All controllers should use these methods for consistent response format.
 */

class ApiResponse {
  /**
   * Send a success response
   */
  static success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId: res.req?.id || undefined,
    };

    if (meta) response.meta = meta;

    return res.status(statusCode).json(response);
  }

  /**
   * Send a created response
   */
  static created(res, data = null, message = 'Resource created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  /**
   * Send a no content response
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Send an error response
   */
  static error(res, message = 'An error occurred', statusCode = 500, errorCode = 'INTERNAL_ERROR', errors = []) {
    const response = {
      success: false,
      message,
      errorCode,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId: res.req?.id || undefined,
    };

    if (errors && errors.length > 0) response.errors = errors;

    return res.status(statusCode).json(response);
  }

  /**
   * Send a paginated response
   */
  static paginated(res, data, paginationInfo, message = 'Data retrieved successfully') {
    const { docs, totalDocs, limit, page, totalPages, hasNextPage, hasPrevPage } = paginationInfo;

    return ApiResponse.success(
      res,
      docs || data,
      message,
      200,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalDocs,
        totalPages,
        hasNextPage,
        hasPrevPage,
      }
    );
  }
}

// ─── Express response method extensions ──────────────────────────────────────
function extendResponse(req, res, next) {
  res.success = (data, message, statusCode) =>
    ApiResponse.success(res, data, message, statusCode);

  res.created = (data, message) =>
    ApiResponse.created(res, data, message);

  res.noContent = () =>
    ApiResponse.noContent(res);

  res.paginated = (data, pagination, message) =>
    ApiResponse.paginated(res, data, pagination, message);

  next();
}

module.exports = ApiResponse;
module.exports.extendResponse = extendResponse;
