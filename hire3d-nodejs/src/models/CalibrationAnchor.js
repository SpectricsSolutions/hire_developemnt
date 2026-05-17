'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CalibrationAnchor = sequelize.define(
  'CalibrationAnchor',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    controlTemplateId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'control_template_id',
    },
    ragLevel: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'rag_level',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    severityHint: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'severity_hint',
    },
  },
  {
    tableName: 'calibration_anchors',
    underscored: true,
  },
);

module.exports = CalibrationAnchor;
