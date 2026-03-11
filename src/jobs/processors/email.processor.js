'use strict';
const { sendEmail } = require('../../services/email.service');
const logger = require('../../config/logger');

async function processEmailJob(job) {
  logger.info(`Processing email job ${job.id}: ${job.data.subject}`);
  return sendEmail(job.data);
}

module.exports = { processEmailJob };
