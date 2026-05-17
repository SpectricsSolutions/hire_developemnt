'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Engagement = sequelize.define(
  'Engagement',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
    },
    product: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    engagementDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'engagement_date',
    },
    feeCharged: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'fee_charged',
    },
    feeStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'fee_status',
    },
    auditDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'audit_date',
    },
    reportIssuedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'report_issued_date',
    },
    auditStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'SCHEDULED',
      field: 'audit_status',
    },
    overallRag: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'overall_rag',
    },
    riskScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'risk_score',
    },
    nextReviewDue: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'next_review_due',
    },
    engagementLetterSignedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'engagement_letter_signed_at',
    },
    invoiceRaisedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'invoice_raised_at',
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'engagements',
    underscored: true,
  },
);

module.exports = Engagement;
