'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../models/user.model');
const { getQueueStats } = require('../jobs/queue.manager');
const { getConnectionStatus } = require('../config/database');
const ApiResponse = require('../helpers/api-response.helper');

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.get('/stats', async (req, res) => {
  const [queueStats, dbStatus] = await Promise.all([
    getQueueStats(),
    Promise.resolve(getConnectionStatus()),
  ]);
  return ApiResponse.success(res, { queues: queueStats, database: dbStatus });
});

module.exports = router;
