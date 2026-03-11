'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { connectTestDatabase, disconnectTestDatabase, clearDatabase } = require('../helpers/database.helper');

describe('Auth API', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    const validUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'SecurePass123',
    };

    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUser.email);
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should fail with duplicate email', async () => {
      await request(app).post('/api/v1/auth/register').send(validUser);
      const res = await request(app).post('/api/v1/auth/register').send(validUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should fail with weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validUser, password: '123' });

      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should fail login before email verification', async () => {
      await request(app).post('/api/v1/auth/register').send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'SecurePass123',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'SecurePass123',
      });

      expect(res.status).toBe(403); // pending verification
    });

    it('should fail with wrong credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'WrongPass123',
      });

      expect(res.status).toBe(401);
    });
  });
});
