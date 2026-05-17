'use strict';

const { Sequelize } = require('sequelize');
const settings = require('./settings');

const sequelize = new Sequelize(settings.DB_NAME, settings.DB_USERNAME, settings.DB_PASSWORD, {
  host: settings.DB_HOST,
  port: settings.DB_PORT,
  dialect: 'postgres',
  logging: settings.DEBUG ? console.log : false,
  pool: {
    max: settings.DB_POOL_SIZE + settings.DB_MAX_OVERFLOW,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,
    timestamps: true,
  },
});

module.exports = sequelize;
