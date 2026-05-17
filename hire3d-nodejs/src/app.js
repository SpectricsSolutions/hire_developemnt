'use strict';

require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const settings = require('./config/settings');
const auditContextMiddleware = require('./middleware/auditContext');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Trust proxy (needed for accurate IP in rate limiter)
app.set('trust proxy', 1);

// Logging
if (!settings.isTesting) {
  app.use(
    morgan('combined', {
      skip: (req) => req.url === '/health',
    }),
  );
}

// CORS
if (settings.isDevelopment) {
  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request-scoped audit context
app.use(auditContextMiddleware);

// Swagger (development only)
if (settings.isDevelopment) {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: settings.PROJECT_NAME,
        version: settings.PROJECT_VERSION,
        description: settings.PROJECT_DESCRIPTION,
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    apis: ['./src/routes/*.js'],
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/openapi.json', (req, res) => res.json(swaggerSpec));
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
