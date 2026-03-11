'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const { corsOptions } = require('./config/cors');
const { morganOptions } = require('./config/morgan');
const { rateLimiter } = require('./middlewares/rate-limiter.middleware');
const { errorHandler } = require('./middlewares/error-handler.middleware');
const { notFoundHandler } = require('./middlewares/not-found.middleware');
const { requestId } = require('./middlewares/request-id.middleware');
const { requestLogger } = require('./middlewares/request-logger.middleware');
const { securityHeaders } = require('./middlewares/security.middleware');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const logger = require('./config/logger');

const app = express();

// ─── Trust Proxy ────────────────────────────────────────────────────────────
app.set('trust proxy', 1);

// ─── Security Middlewares ────────────────────────────────────────────────────
app.use(helmet());
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(mongoSanitize());

// ─── Request Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Performance ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(requestId);
app.use(morgan(morganOptions.format, morganOptions.options));
app.use(requestLogger);

// ─── Rate Limiting ───────────────────────────────────────────────────────────
app.use('/api', rateLimiter);

// ─── API Documentation ───────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: `${process.env.APP_NAME} API Docs`,
}));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const { getHealthStatus } = require('./helpers/health.helper');
  const health = await getHealthStatus();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use(`/api/${process.env.API_VERSION || 'v1'}`, routes);

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
