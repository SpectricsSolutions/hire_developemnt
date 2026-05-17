'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ControlTemplate = sequelize.define(
  'ControlTemplate',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    product: { type: DataTypes.STRING(50), allowNull: false },
    domain: { type: DataTypes.STRING(1), allowNull: true },
    code: { type: DataTypes.STRING(10), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    whatTesting: { type: DataTypes.TEXT, allowNull: false },
    whyMatters: { type: DataTypes.TEXT, allowNull: false },
    primaryQuestion: { type: DataTypes.TEXT, allowNull: false },
    evidencePrompts: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    lookingFor: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    sampling: { type: DataTypes.TEXT, allowNull: true },
    ifPartial: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  { tableName: 'control_templates', underscored: true },
);

module.exports = ControlTemplate;
