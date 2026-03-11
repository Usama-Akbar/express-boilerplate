'use strict';

const morgan = require('morgan');
const logger = require('./logger');

morgan.token('request-id', (req) => req.id);
morgan.token('user-id', (req) => req.user?.id || '-');
morgan.token('body', (req) => {
  if (!req.body || Object.keys(req.body).length === 0) return '-';
  const sanitized = { ...req.body };
  delete sanitized.password;
  delete sanitized.passwordConfirm;
  delete sanitized.currentPassword;
  return JSON.stringify(sanitized);
});

const skipPaths = ['/health', '/favicon.ico'];

const morganOptions = {
  format: process.env.NODE_ENV === 'production'
    ? ':request-id :remote-addr :method :url :status :res[content-length] :response-time ms :user-id'
    : ':request-id :method :url :status :response-time ms :user-id',
  options: {
    skip: (req) => skipPaths.some((p) => req.path.startsWith(p)),
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  },
};

module.exports = { morganOptions };
