'use strict';

const mongoose = require('mongoose');
const { isRedisConnected } = require('../config/redis');
const os = require('os');

async function getHealthStatus() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkMemory(),
  ]);

  const [dbCheck, redisCheck, memoryCheck] = checks.map((c) =>
    c.status === 'fulfilled' ? c.value : { status: 'unhealthy', error: c.reason?.message }
  );

  const allHealthy = [dbCheck, redisCheck, memoryCheck].every(
    (c) => c.status === 'healthy' || c.status === 'degraded'
  );

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      database: dbCheck,
      redis: redisCheck,
      memory: memoryCheck,
    },
  };
}

async function checkDatabase() {
  const readyState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const isHealthy = readyState === 1;

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    state: states[readyState],
    latency: isHealthy ? await measureDbLatency() : null,
  };
}

async function measureDbLatency() {
  const start = Date.now();
  await mongoose.connection.db.admin().ping();
  return `${Date.now() - start}ms`;
}

async function checkRedis() {
  const connected = isRedisConnected();
  return {
    status: connected ? 'healthy' : 'degraded',
    connected,
  };
}

async function checkMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usagePercent = (used / total) * 100;

  return {
    status: usagePercent < 90 ? 'healthy' : 'warning',
    total: `${Math.round(total / 1024 / 1024)}MB`,
    used: `${Math.round(used / 1024 / 1024)}MB`,
    free: `${Math.round(free / 1024 / 1024)}MB`,
    usagePercent: `${usagePercent.toFixed(1)}%`,
    processHeap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  };
}

module.exports = { getHealthStatus };
