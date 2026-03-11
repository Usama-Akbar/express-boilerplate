'use strict';

const Bull = require('bull');
const logger = require('../config/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

// ─── Queue Definitions ────────────────────────────────────────────────────────
const queues = {};

function createQueue(name, options = {}) {
  const queue = new Bull(name, {
    redis: redisConfig,
    defaultJobOptions: { ...defaultJobOptions, ...options.defaultJobOptions },
    limiter: {
      max: parseInt(process.env.QUEUE_LIMITER_MAX) || 10,
      duration: parseInt(process.env.QUEUE_LIMITER_DURATION) || 5000,
    },
  });

  queue.on('completed', (job) => {
    logger.debug(`Queue [${name}] Job ${job.id} completed`);
  });

  queue.on('failed', (job, err) => {
    logger.error(`Queue [${name}] Job ${job.id} failed:`, err.message);
  });

  queue.on('stalled', (job) => {
    logger.warn(`Queue [${name}] Job ${job.id} stalled`);
  });

  queues[name] = queue;
  return queue;
}

// ─── Queue Instances ─────────────────────────────────────────────────────────
const emailQueue = createQueue('email');
const notificationQueue = createQueue('notification');
const reportQueue = createQueue('report', {
  defaultJobOptions: { attempts: 2, timeout: 300000 }, // 5 min timeout
});
const cleanupQueue = createQueue('cleanup');
const webhookQueue = createQueue('webhook', {
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
});

async function initializeQueues() {
  // Register processors
  const { processEmailJob } = require('./processors/email.processor');
  const { processNotificationJob } = require('./processors/notification.processor');
  const { processWebhookJob } = require('./processors/webhook.processor');

  emailQueue.process(parseInt(process.env.QUEUE_CONCURRENCY) || 5, processEmailJob);
  notificationQueue.process(parseInt(process.env.QUEUE_CONCURRENCY) || 5, processNotificationJob);
  webhookQueue.process(3, processWebhookJob);

  // Schedule recurring jobs
  await cleanupQueue.add('cleanup-expired-tokens', {}, {
    repeat: { cron: '0 2 * * *' }, // Daily at 2am
    jobId: 'cleanup-expired-tokens',
  });

  logger.info('✅ Job queues initialized');
}

async function getQueueStats() {
  const stats = {};
  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    stats[name] = { waiting, active, completed, failed, delayed };
  }
  return stats;
}

async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  logger.info('All queues closed');
}

module.exports = {
  emailQueue,
  notificationQueue,
  reportQueue,
  cleanupQueue,
  webhookQueue,
  queues,
  initializeQueues,
  getQueueStats,
  closeQueues,
};
