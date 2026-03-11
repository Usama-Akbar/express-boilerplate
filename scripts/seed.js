'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const logger = require('../src/config/logger');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to database for seeding...');

  // Clear existing data
  await Promise.all([User.deleteMany({}), Organization.deleteMany({})]);
  logger.info('Cleared existing data');

  // Create super admin
  const superAdmin = await User.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@saasapp.com',
    password: 'Admin@123456',
    role: User.ROLES.SUPER_ADMIN,
    status: User.STATUSES.ACTIVE,
    isEmailVerified: true,
  });
  logger.info(`Created super admin: ${superAdmin.email}`);

  // Create demo org
  const org = await Organization.create({
    name: 'Acme Corporation',
    ownerId: superAdmin._id,
    plan: Organization.PLANS.PROFESSIONAL,
    members: [{ userId: superAdmin._id, role: 'owner' }],
    isActive: true,
  });

  superAdmin.organizationId = org._id;
  await superAdmin.save({ validateBeforeSave: false });

  // Create demo users
  const demoUsers = await User.insertMany(
    Array.from({ length: 10 }, () => ({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      password: 'Demo@123456',
      role: User.ROLES.USER,
      status: User.STATUSES.ACTIVE,
      isEmailVerified: true,
      organizationId: org._id,
    }))
  );
  logger.info(`Created ${demoUsers.length} demo users`);

  logger.info('✅ Seeding complete!');
  logger.info('\n─── Demo Credentials ───────────────────');
  logger.info(`Admin:  admin@saasapp.com / Admin@123456`);
  logger.info('────────────────────────────────────────');

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error('Seeding failed:', err);
  process.exit(1);
});
