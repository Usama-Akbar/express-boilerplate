'use strict';

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const AppError = require('../helpers/app-error.helper');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 10, // messages per second
  });

  return transporter;
}

/**
 * Render a Handlebars email template
 */
function renderTemplate(templateName, context = {}) {
  try {
    const Handlebars = require('handlebars');
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      logger.warn(`Email template not found: ${templateName}. Using plain text.`);
      return null;
    }

    const source = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(source);
    return template({
      ...context,
      appName: process.env.APP_NAME || 'SaaS App',
      appUrl: process.env.APP_URL,
      year: new Date().getFullYear(),
    });
  } catch (err) {
    logger.error(`Template rendering error for ${templateName}:`, err.message);
    return null;
  }
}

/**
 * Send a transactional email
 */
async function sendEmail({ to, subject, template, html, text, context = {}, attachments = [], cc, bcc }) {
  if (process.env.NODE_ENV === 'test') {
    logger.debug(`[TEST] Email skipped: to=${to}, subject=${subject}`);
    return { messageId: 'test-message-id' };
  }

  const mailTransporter = getTransporter();

  let htmlContent = html;
  let textContent = text;

  if (template && !html) {
    htmlContent = renderTemplate(template, context);
  }

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to,
    subject,
    html: htmlContent,
    text: textContent || (htmlContent ? htmlContent.replace(/<[^>]*>/g, '') : undefined),
    attachments,
  };

  if (cc) mailOptions.cc = cc;
  if (bcc) mailOptions.bcc = bcc;

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId} to ${to}`);
    return info;
  } catch (error) {
    logger.error(`Email send failed to ${to}:`, error.message);
    throw new AppError('Failed to send email', 500, 'EMAIL_SEND_ERROR');
  }
}

/**
 * Send bulk emails with rate limiting
 */
async function sendBulkEmails(emails) {
  const pLimit = require('p-limit');
  const limit = pLimit(5); // 5 concurrent
  const results = await Promise.allSettled(emails.map((email) => limit(() => sendEmail(email))));
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info(`Bulk email: ${succeeded} sent, ${failed} failed out of ${emails.length}`);
  return { succeeded, failed, total: emails.length };
}

/**
 * Verify SMTP connection
 */
async function verifyConnection() {
  try {
    await getTransporter().verify();
    logger.info('✅ SMTP connection verified');
    return true;
  } catch (err) {
    logger.warn('SMTP verification failed:', err.message);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendBulkEmails,
  verifyConnection,
};
