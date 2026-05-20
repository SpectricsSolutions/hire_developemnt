'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Engagement = sequelize.define(
  'Engagement',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false },
    engagementReference: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    product: { type: DataTypes.STRING(50), allowNull: false },
    engagementDate: { type: DataTypes.DATEONLY, allowNull: false },
    feeCharged: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue('feeCharged');
        return val === null ? null : parseFloat(val);
      },
    },
    feeStatus: { type: DataTypes.STRING(50), allowNull: false },
    auditDate: { type: DataTypes.DATEONLY, allowNull: true },
    reportIssuedDate: { type: DataTypes.DATEONLY, allowNull: true },
    auditStatus: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'SCHEDULED' },
    overallRag: { type: DataTypes.STRING(50), allowNull: true },
    riskScore: { type: DataTypes.INTEGER, allowNull: true },
    nextReviewDue: { type: DataTypes.DATEONLY, allowNull: true },
    engagementLetterSignedAt: { type: DataTypes.DATEONLY, allowNull: true },
    invoiceRaisedAt: { type: DataTypes.DATEONLY, allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  { tableName: 'engagements', underscored: true },
);

module.exports = Engagement;
