'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'actor_id',
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    event: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    resourceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'resource_type',
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'resource_id',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    tableName: 'audit_logs',
    timestamps: false,
    underscored: true,
  },
);

module.exports = AuditLog;
