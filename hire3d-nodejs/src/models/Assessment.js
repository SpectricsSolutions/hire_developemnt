'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Assessment = sequelize.define(
  'Assessment',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    engagementId: { type: DataTypes.UUID, allowNull: false, unique: true },
    phase1StartedAt: { type: DataTypes.DATE, allowNull: true },
    phase1StartedById: { type: DataTypes.UUID, allowNull: true },
    phase1ClosedAt: { type: DataTypes.DATE, allowNull: true },
    phase1ClosedById: { type: DataTypes.UUID, allowNull: true },
    phase2SubmittedAt: { type: DataTypes.DATE, allowNull: true },
    phase2SubmittedById: { type: DataTypes.UUID, allowNull: true },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'assessments', underscored: true },
);

module.exports = Assessment;
