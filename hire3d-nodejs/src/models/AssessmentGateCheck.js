'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AssessmentGateCheck = sequelize.define(
  'AssessmentGateCheck',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    assessmentId: { type: DataTypes.UUID, allowNull: true },
    engagementId: { type: DataTypes.UUID, allowNull: false },
    gate: { type: DataTypes.STRING(50), allowNull: false },
    passed: { type: DataTypes.BOOLEAN, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    checkedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    actorId: { type: DataTypes.UUID, allowNull: true },
  },
  { tableName: 'assessment_gate_checks', timestamps: false, underscored: true },
);

module.exports = AssessmentGateCheck;
