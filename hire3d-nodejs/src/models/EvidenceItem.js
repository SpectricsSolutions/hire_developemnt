'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EvidenceItem = sequelize.define(
  'EvidenceItem',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    controlId: { type: DataTypes.UUID, allowNull: false },
    engagementId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM('seen', 'requested', 'not_provided', 'partial'),
      allowNull: false,
    },
    deadline: { type: DataTypes.DATEONLY, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'evidence_items', underscored: true },
);

module.exports = EvidenceItem;
