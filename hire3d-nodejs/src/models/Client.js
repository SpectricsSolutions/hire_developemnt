'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define(
  'Client',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    companyName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'company_name',
    },
    companiesHouseNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'companies_house_number',
    },
    primaryContactName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'primary_contact_name',
    },
    primaryContactEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'primary_contact_email',
    },
    primaryContactPhone: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'primary_contact_phone',
    },
    sector: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    headcountAtEngagement: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'headcount_at_engagement',
    },
    currentHeadcount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'current_headcount',
    },
    businessStage: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'business_stage',
    },
    region: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    assignedOperatorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assigned_operator_id',
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'internal_notes',
    },
    introducerFeeApplicable: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'introducer_fee_applicable',
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'clients',
    underscored: true,
  },
);

module.exports = Client;
