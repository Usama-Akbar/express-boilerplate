'use strict';

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const organizationRoutes = require('./organization.routes');
const billingRoutes = require('./billing.routes');
const adminRoutes = require('./admin.routes');
const webhookRoutes = require('./webhook.routes');

// ─── Public Routes ────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);

// ─── Protected Routes ─────────────────────────────────────────────────────────
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/billing', billingRoutes);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
router.use('/admin', adminRoutes);

module.exports = router;
