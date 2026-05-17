'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    actorId: { type: DataTypes.UUID, allowNull: true },
    action: { type: DataTypes.STRING(50), allowNull: false },
    event: { type: DataTypes.STRING(100), allowNull: true },
    resourceType: { type: DataTypes.STRING(50), allowNull: false },
    resourceId: { type: DataTypes.UUID, allowNull: true },
    ipAddress: { type: DataTypes.STRING(45), allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'audit_logs', timestamps: false, underscored: true },
);

module.exports = AuditLog;
