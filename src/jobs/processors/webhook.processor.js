'use strict';
const axios = require('axios');
const { generateHmacSignature } = require('../../utils/encryption.util');
const logger = require('../../config/logger');

async function processWebhookJob(job) {
  const { url, event, payload, secret } = job.data;
  const signature = generateHmacSignature(payload, secret || process.env.WEBHOOK_SECRET);

  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event,
      'X-Webhook-Delivery': job.id,
    },
    timeout: 10000,
  });

  logger.info(`Webhook delivered: ${event} → ${url} (${response.status})`);
  return { status: response.status };
}

module.exports = { processWebhookJob };
