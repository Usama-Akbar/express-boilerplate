'use strict';

const logger = require('./logger');

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (
      process.env.NODE_ENV === 'development' ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*')
    ) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-API-Key',
    'Accept',
    'Accept-Language',
  ],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count', 'X-Rate-Limit-Remaining'],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 200,
};

module.exports = { corsOptions };
