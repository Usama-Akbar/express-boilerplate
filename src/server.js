'use strict';

require('dotenv').config();
require('express-async-errors');
const http = require('http');
const app = require('./app');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./config/logger');
const { initializeQueues } = require('./jobs/queue.manager');
const { initializeSocket } = require('./config/socket');
const { gracefulShutdown } = require('./helpers/shutdown.helper');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();

    // Initialize job queues
    await initializeQueues();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket
    initializeSocket(server);

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

    // Unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown(server, 'unhandledRejection');
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown(server, 'uncaughtException');
    });

    return server;
  } catch (error) {
    logger.error('Failed to bootstrap application:', error);
    process.exit(1);
  }
}

bootstrap();
