'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const P1Evidence = sequelize.define(
  'P1Evidence',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    engagementId: { type: DataTypes.UUID, allowNull: false },
    controlId: { type: DataTypes.UUID, allowNull: false },
    // Delivery status only — NO RAG, severity, consequence, or findings fields (Phase 1 gate).
    status: {
      type: DataTypes.ENUM('not_provided', 'seen', 'partial', 'requested'),
      allowNull: false,
      defaultValue: 'not_provided',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },           // verbal evidence / session notes
    documentNotes: { type: DataTypes.TEXT, allowNull: true },   // documents produced (US-021)
    documentLink: { type: DataTypes.STRING(2048), allowNull: true }, // URL link to document (US-021)
    fileUrl: { type: DataTypes.STRING(500), allowNull: true },
    fileName: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: 'p1_evidence',
    underscored: true,
    indexes: [
      { fields: ['engagement_id'] },
      { fields: ['control_id'] },
      {
        unique: true,
        name: 'uq_p1_evidence_engagement_control',
        fields: ['engagement_id', 'control_id'],
      },
    ],
  },
);

module.exports = P1Evidence;
