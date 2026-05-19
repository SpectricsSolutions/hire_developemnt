'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CalibrationAnchor = sequelize.define(
  'CalibrationAnchor',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    controlTemplateId: { type: DataTypes.UUID, allowNull: false },
    ragLevel: { type: DataTypes.STRING(20), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    whatThisMeans: { type: DataTypes.TEXT, allowNull: true },
    evidenceDescriptors: { type: DataTypes.TEXT, allowNull: true },
    minimumStandard: { type: DataTypes.TEXT, allowNull: true },
    severityHint: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: 'calibration_anchors', underscored: true },
);

module.exports = CalibrationAnchor;
