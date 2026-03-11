'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (e.g., API keys, secrets stored in DB)
 */
function encrypt(text) {
  if (!text) return null;
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY environment variable not set');

  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt encrypted data
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY environment variable not set');

  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) throw new Error('Invalid encrypted text format');

  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a secure random token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a value with SHA-256 (for token storage in DB)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate HMAC signature (for webhooks)
 */
function generateHmacSignature(payload, secret) {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
}

/**
 * Verify HMAC signature (for webhook validation)
 */
function verifyHmacSignature(payload, signature, secret) {
  const expected = generateHmacSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

/**
 * Generate a numeric OTP
 */
function generateOtp(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(crypto.randomInt(min, max));
}

module.exports = {
  encrypt,
  decrypt,
  generateSecureToken,
  hashToken,
  generateHmacSignature,
  verifyHmacSignature,
  generateOtp,
};
