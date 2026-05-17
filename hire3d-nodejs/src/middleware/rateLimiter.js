'use strict';

const rateLimit = require('express-rate-limit');
const settings = require('../config/settings');

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: settings.LOGIN_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  },
});

module.exports = { loginLimiter };
