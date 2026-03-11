# 🚀 Enterprise SaaS Express.js Boilerplate

A production-ready, enterprise-grade Express.js + MongoDB boilerplate for building scalable SaaS applications.

## ✨ Features

| Category | Technologies |
|---|---|
| **Runtime** | Node.js 18+, Express 4 |
| **Database** | MongoDB + Mongoose (pooled, auto-reconnect) |
| **Cache / Queue** | Redis + Bull job queues |
| **Auth** | JWT (access + refresh), OAuth (Google/GitHub), 2FA (TOTP) |
| **Storage** | AWS S3 + Sharp image processing |
| **Email** | Nodemailer + Handlebars templates |
| **Payments** | Stripe subscriptions + webhooks |
| **Real-time** | Socket.io |
| **API Docs** | Swagger / OpenAPI 3.0 |
| **Logging** | Winston + daily log rotation |
| **Validation** | Joi schema validation |
| **Security** | Helmet, CORS, rate limiting, XSS/NoSQL injection protection |
| **Testing** | Jest + Supertest + MongoDB Memory Server |

## 📁 Project Structure

```
src/
├── config/          # Database, Redis, Logger, CORS, Swagger, Socket.io
├── controllers/     # Route handlers (thin layer)
├── middlewares/     # Auth, error handler, rate limiter, validation, audit
├── models/          # Mongoose models with indexes & virtuals
├── routes/          # Express router definitions with Swagger JSDoc
├── services/        # Business logic (Auth, Email, Storage, Billing)
├── validators/      # Joi validation schemas
├── helpers/         # AppError, ApiResponse, Token, Pagination, Health
├── utils/           # Encryption, string/date/object utilities
├── jobs/            # Bull queue manager + processors
├── templates/       # Handlebars email templates
├── app.js           # Express app setup
└── server.js        # Bootstrap & graceful shutdown
tests/
├── unit/            # Unit tests
├── integration/     # Integration tests with in-memory MongoDB
└── helpers/         # Test utilities
scripts/
├── seed.js          # Database seeder
└── migrate.js       # Migration runner
```

## 🚦 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start MongoDB & Redis (Docker)
docker run -d -p 27017:27017 mongo:7
docker run -d -p 6379:6379 redis:7-alpine

# 4. Seed the database
npm run seed

# 5. Start development server
npm run dev
```

## 🔑 API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new user |
| `POST` | `/api/v1/auth/login` | Login |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `POST` | `/api/v1/auth/logout` | Logout |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset |
| `POST` | `/api/v1/auth/reset-password/:token` | Reset password |
| `GET` | `/api/v1/auth/me` | Get current user |
| `GET` | `/api/v1/users` | List users (admin) |
| `PATCH` | `/api/v1/users/me` | Update profile |
| `POST` | `/api/v1/users/me/avatar` | Upload avatar |
| `GET` | `/health` | Health check |
| `GET` | `/api-docs` | Swagger UI |

## 🔐 Security Features

- JWT access tokens (15m) + rotating refresh tokens (30d)
- Refresh token family invalidation on reuse
- Token blacklisting via Redis
- Bcrypt password hashing (12 rounds)
- Rate limiting per route
- MongoDB injection protection
- XSS sanitization
- Helmet HTTP headers
- HMAC webhook verification
- AES-256-CBC data encryption

## 🧪 Testing

```bash
npm test              # Run all tests with coverage
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

## 📦 Environment Variables

See `.env.example` for all configuration options with descriptions.

## 🏗️ SaaS Multi-tenancy Model

- **Organization** entity is the tenant unit
- Users belong to Organizations with role-based access
- Per-org plan limits (users, storage, API calls)
- Stripe subscription per Organization
- Audit logging per organization

## 📄 License

MIT
