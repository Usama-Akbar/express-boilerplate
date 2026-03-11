'use strict';

const logger = require('../config/logger');
const { disconnectDatabase } = require('../config/database');
const { disconnectRedis } = require('../config/redis');

const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

async function gracefulShutdown(server, signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  forceExit.unref();

  try {
    // 1. Stop accepting new connections
    await closeServer(server);
    logger.info('HTTP server closed');

    // 2. Disconnect databases
    await disconnectDatabase();
    logger.info('Database disconnected');

    await disconnectRedis();
    logger.info('Redis disconnected');

    // 3. Exit cleanly
    clearTimeout(forceExit);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { gracefulShutdown };
