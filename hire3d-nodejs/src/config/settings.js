'use strict';

require('dotenv').config();

const settings = {
  PROJECT_NAME: 'Hire 3D',
  PROJECT_DESCRIPTION: 'API for Hire 3D',
  PROJECT_VERSION: '1.0.0',

  ENVIRONMENT: process.env.ENVIRONMENT || 'PRODUCTION',
  DEBUG: process.env.DEBUG === 'true',

  API_HOST: process.env.API_HOST || '0.0.0.0',
  API_PORT: parseInt(process.env.API_PORT || '8000', 10),

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USERNAME: process.env.DB_USERNAME || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'hire3d',
  DB_POOL_SIZE: parseInt(process.env.POOL_SIZE || '5', 10),
  DB_MAX_OVERFLOW: parseInt(process.env.MAX_OVERFLOW || '10', 10),

  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(
    process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES || '15',
    10,
  ),

  REFRESH_TOKEN_EXPIRE_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || '7', 10),

  TOTP_TOKEN_EXPIRE_MINUTES: parseInt(process.env.TOTP_TOKEN_EXPIRE_MINUTES || '5', 10),
  TOTP_REQUIRED_ROLES: (process.env.TOTP_REQUIRED_ROLES || 'ADMIN').split(','),
  TOTP_ISSUER: process.env.TOTP_ISSUER || 'Hire3D',

  LOGIN_RATE_LIMIT_PER_MINUTE: parseInt(process.env.LOGIN_RATE_LIMIT_PER_MINUTE || '5', 10),

  get isDevelopment() {
    return this.ENVIRONMENT === 'DEVELOPMENT';
  },
  get isProduction() {
    return this.ENVIRONMENT === 'PRODUCTION';
  },
  get isTesting() {
    return this.ENVIRONMENT === 'TESTING';
  },

  get databaseUrl() {
    return `postgresql://${this.DB_USERNAME}:${this.DB_PASSWORD}@${this.DB_HOST}:${this.DB_PORT}/${this.DB_NAME}`;
  },
};

module.exports = settings;
