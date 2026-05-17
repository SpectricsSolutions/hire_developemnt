'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserTOTP = sequelize.define(
  'UserTOTP',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    secret: { type: DataTypes.STRING(64), allowNull: false },
    isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: 'totp_credentials', underscored: true },
);

module.exports = UserTOTP;
