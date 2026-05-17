'use strict';

// Set test environment variables before any module is loaded in each test process.
process.env.ENVIRONMENT = 'TESTING';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'hire3d_test';
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret-do-not-use-in-production';
process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '1000';
process.env.REFRESH_TOKEN_EXPIRE_DAYS = '1';
