'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define(
  'Client',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    companyName: { type: DataTypes.STRING(255), allowNull: false },
    companiesHouseNumber: { type: DataTypes.STRING(50), allowNull: true },
    primaryContactName: { type: DataTypes.STRING(100), allowNull: false },
    primaryContactEmail: { type: DataTypes.STRING(255), allowNull: false },
    primaryContactPhone: { type: DataTypes.STRING(30), allowNull: true },
    sector: { type: DataTypes.STRING(100), allowNull: true },
    headcountAtEngagement: { type: DataTypes.INTEGER, allowNull: false },
    currentHeadcount: { type: DataTypes.INTEGER, allowNull: true },
    businessStage: { type: DataTypes.STRING(50), allowNull: false },
    region: { type: DataTypes.STRING(50), allowNull: false },
    assignedOperatorId: { type: DataTypes.UUID, allowNull: true },
    internalNotes: { type: DataTypes.TEXT, allowNull: true },
    introducerFeeApplicable: { type: DataTypes.BOOLEAN, allowNull: true },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'ACTIVE' },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  { tableName: 'clients', underscored: true },
);

module.exports = Client;
