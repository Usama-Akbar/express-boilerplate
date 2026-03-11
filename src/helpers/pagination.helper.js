'use strict';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Extract and normalize pagination parameters from request query
 */
function getPaginationOptions(query = {}) {
  let page = parseInt(query.page) || DEFAULT_PAGE;
  let limit = parseInt(query.limit) || DEFAULT_LIMIT;

  if (page < 1) page = DEFAULT_PAGE;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit };
}

/**
 * Build sort object from query string
 * e.g., sort=name,-createdAt → { name: 1, createdAt: -1 }
 */
function getSortOptions(query = {}, defaultSort = { createdAt: -1 }) {
  if (!query.sort) return defaultSort;

  const sort = {};
  query.sort.split(',').forEach((field) => {
    if (field.startsWith('-')) {
      sort[field.slice(1)] = -1;
    } else {
      sort[field] = 1;
    }
  });

  return sort;
}

/**
 * Build field selection from query string
 * e.g., fields=name,email → { name: 1, email: 1 }
 */
function getFieldSelection(query = {}) {
  if (!query.fields) return null;
  return query.fields.split(',').join(' ');
}

/**
 * Build mongoose-paginate-v2 options
 */
function buildPaginateOptions(query = {}) {
  const { page, limit } = getPaginationOptions(query);
  const sort = getSortOptions(query);
  const select = getFieldSelection(query);

  const options = {
    page,
    limit,
    sort,
    lean: true,
    leanWithId: false,
  };

  if (select) options.select = select;

  return options;
}

/**
 * Format paginated result for API response
 */
function formatPaginatedResult(result) {
  return {
    data: result.docs,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.totalDocs,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      nextPage: result.nextPage,
      prevPage: result.prevPage,
    },
  };
}

module.exports = {
  getPaginationOptions,
  getSortOptions,
  getFieldSelection,
  buildPaginateOptions,
  formatPaginatedResult,
};
