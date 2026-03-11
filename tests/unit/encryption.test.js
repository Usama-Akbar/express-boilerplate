'use strict';

process.env.ENCRYPTION_KEY = 'test_32_char_key_for_unit_tests!!';

const {
  encrypt,
  decrypt,
  generateSecureToken,
  hashToken,
  generateHmacSignature,
  verifyHmacSignature,
  generateOtp,
} = require('../../src/utils/encryption.util');

describe('Encryption Utils', () => {
  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a string', () => {
      const original = 'sensitive data';
      const encrypted = encrypt(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain(':');
      expect(decrypt(encrypted)).toBe(original);
    });

    it('should return null for null input', () => {
      expect(encrypt(null)).toBeNull();
      expect(decrypt(null)).toBeNull();
    });

    it('should produce different ciphertexts for same input', () => {
      const enc1 = encrypt('test');
      const enc2 = encrypt('test');
      expect(enc1).not.toBe(enc2);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate unique tokens', () => {
      const t1 = generateSecureToken();
      const t2 = generateSecureToken();
      expect(t1).not.toBe(t2);
      expect(t1.length).toBe(64);
    });
  });

  describe('hashToken', () => {
    it('should produce consistent hashes', () => {
      const token = 'mytoken';
      expect(hashToken(token)).toBe(hashToken(token));
    });
  });

  describe('HMAC signature', () => {
    it('should generate and verify signatures', () => {
      const payload = { event: 'user.created', data: { id: '123' } };
      const secret = 'my-webhook-secret';
      const sig = generateHmacSignature(payload, secret);
      expect(verifyHmacSignature(payload, sig, secret)).toBe(true);
    });

    it('should reject tampered signatures', () => {
      const sig = generateHmacSignature('data', 'secret');
      expect(verifyHmacSignature('different-data', sig, 'secret')).toBe(false);
    });
  });

  describe('generateOtp', () => {
    it('should generate numeric OTPs of correct length', () => {
      const otp = generateOtp(6);
      expect(otp).toMatch(/^\d{6}$/);
    });
  });
});
