'use strict';

const Redis = require('ioredis');
const logger = require('./logger');

let redisClient = null;
let isConnected = false;

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis retry attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) return true;
    return false;
  },
  lazyConnect: true,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  connectTimeout: 10000,
};

async function connectRedis() {
  try {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      logger.info('✅ Redis connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis ready');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err.message);
      isConnected = false;
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error.message);
    // Non-fatal: app can run without Redis (degraded mode)
    logger.warn('Running in degraded mode without Redis');
    return null;
  }
}

function getRedisClient() {
  return redisClient;
}

function isRedisConnected() {
  return isConnected && redisClient && redisClient.status === 'ready';
}

async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    isConnected = false;
    logger.info('Redis disconnected');
  }
}

// ─── Cache helpers ───────────────────────────────────────────────────────────
async function cacheGet(key) {
  if (!isRedisConnected()) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.error(`Cache get error for key ${key}:`, err.message);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 3600) {
  if (!isRedisConnected()) return false;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (err) {
    logger.error(`Cache set error for key ${key}:`, err.message);
    return false;
  }
}

async function cacheDel(key) {
  if (!isRedisConnected()) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    logger.error(`Cache del error for key ${key}:`, err.message);
    return false;
  }
}

async function cacheDelPattern(pattern) {
  if (!isRedisConnected()) return false;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return true;
  } catch (err) {
    logger.error(`Cache del pattern error for ${pattern}:`, err.message);
    return false;
  }
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  isRedisConnected,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
};
