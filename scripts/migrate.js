'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../src/config/logger');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to database for migration...');
  // Add migration logic here
  logger.info('✅ Migration complete');
  await mongoose.disconnect();
}

migrate().catch(err => { logger.error(err); process.exit(1); });
