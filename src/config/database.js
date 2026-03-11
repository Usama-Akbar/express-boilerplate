'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/saas_db';

const connectionOptions = {
  maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE) || 10,
  serverSelectionTimeoutMS: parseInt(process.env.MONGODB_TIMEOUT) || 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: 'majority',
};

let isConnected = false;

async function connectDatabase() {
  if (isConnected) {
    logger.info('MongoDB already connected');
    return mongoose.connection;
  }

  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      logger.info('✅ MongoDB connected successfully');
      isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnect...');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });

    await mongoose.connect(MONGODB_URI, connectionOptions);
    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    throw error;
  }
}

async function disconnectDatabase() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}

function getConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    status: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    poolSize: connectionOptions.maxPoolSize,
  };
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getConnectionStatus,
};
