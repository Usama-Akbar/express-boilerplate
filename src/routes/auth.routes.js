'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authRateLimiter, passwordResetLimiter } = require('../middlewares/rate-limiter.middleware');
const { validate } = require('../middlewares/not-found.middleware');
const authValidators = require('../validators/auth.validators');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */

// ─── Public Auth Routes ───────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, password]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               organizationName: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/register',
  authRateLimiter,
  validate(authValidators.register),
  authController.register.bind(authController)
);

router.post('/login',
  authRateLimiter,
  validate(authValidators.login),
  authController.login.bind(authController)
);

router.post('/refresh',
  authController.refresh.bind(authController)
);

router.post('/forgot-password',
  passwordResetLimiter,
  validate(authValidators.forgotPassword),
  authController.forgotPassword.bind(authController)
);

router.post('/reset-password/:token',
  validate(authValidators.resetPassword),
  authController.resetPassword.bind(authController)
);

router.get('/verify-email/:token',
  authController.verifyEmail.bind(authController)
);

router.post('/verify-2fa',
  validate(authValidators.verifyTwoFactor),
  authController.verifyTwoFactor.bind(authController)
);

// ─── Protected Auth Routes ────────────────────────────────────────────────────

router.use(authenticate);

router.get('/me',
  authController.getMe.bind(authController)
);

router.post('/logout',
  authController.logout.bind(authController)
);

router.post('/logout-all',
  authController.logoutAll.bind(authController)
);

router.post('/change-password',
  validate(authValidators.changePassword),
  authController.changePassword.bind(authController)
);

router.post('/resend-verification',
  authController.resendVerification.bind(authController)
);

module.exports = router;
