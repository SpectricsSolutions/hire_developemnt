'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AssessmentGateCheck = sequelize.define(
  'AssessmentGateCheck',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assessmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assessment_id',
    },
    engagementId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'engagement_id',
    },
    gate: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    passed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    checkedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'checked_at',
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'actor_id',
    },
  },
  {
    tableName: 'assessment_gate_checks',
    timestamps: false,
    underscored: true,
  },
);

module.exports = AssessmentGateCheck;
