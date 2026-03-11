'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Custom Formats ──────────────────────────────────────────────────────────
const { combine, timestamp, errors, splat, json, colorize, printf } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, stack, requestId, ...meta }) => {
  const rid = requestId ? `[${requestId}] ` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const base = `${timestamp} [${level.toUpperCase()}] ${rid}${message}${metaStr}`;
  return stack ? `${base}\n${stack}` : base;
});

const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  splat(),
  json()
);

// ─── Transports ──────────────────────────────────────────────────────────────
const transports = [];

// Console transport
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat
      ),
    })
  );
}

// File transports (production)
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: fileFormat,
      level: 'info',
    }),
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '30d',
      format: fileFormat,
      level: 'error',
    })
  );
}

// ─── Logger Instance ─────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: {
    service: process.env.APP_NAME || 'saas-app',
    environment: process.env.NODE_ENV || 'development',
  },
  transports,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test',
});

// ─── Child Logger Factory ─────────────────────────────────────────────────────
logger.createChildLogger = (meta) => logger.child(meta);

module.exports = logger;
