'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Assessment = sequelize.define(
  'Assessment',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    engagementId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'engagement_id',
    },
    phase1StartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'phase_1_started_at',
    },
    phase1StartedById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'phase_1_started_by_id',
    },
    phase1ClosedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'phase_1_closed_at',
    },
    phase1ClosedById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'phase_1_closed_by_id',
    },
    phase2SubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'phase_2_submitted_at',
    },
    phase2SubmittedById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'phase_2_submitted_by_id',
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'cancelled_at',
    },
  },
  {
    tableName: 'assessments',
    underscored: true,
  },
);

module.exports = Assessment;
