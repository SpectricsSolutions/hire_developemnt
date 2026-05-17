'use strict';

const Joi = require('joi');

const PRODUCTS = ['HIRE_READY', 'THE_CHECK', 'HIRE_3D_CORE', 'HIRE_3D_ENHANCED'];
const FEE_STATUSES = ['INVOICED', 'PAID', 'OVERDUE'];
const AUDIT_STATUSES = ['SCHEDULED', 'PHASE_1_COMPLETE', 'PHASE_2_COMPLETE', 'REPORT_ISSUED'];

const dateStr = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .allow(null)
  .default(null);

const engagementBaseSchema = {
  product: Joi.string().valid(...PRODUCTS).required(),
  engagementDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  feeCharged: Joi.number().min(0).precision(2).required(),
  feeStatus: Joi.string().valid(...FEE_STATUSES).required(),
  auditDate: dateStr,
  reportIssuedDate: dateStr,
  auditStatus: Joi.string().valid(...AUDIT_STATUSES).default('SCHEDULED'),
  nextReviewDue: dateStr,
  engagementLetterSignedAt: dateStr,
  invoiceRaisedAt: dateStr,
};

const createEngagementSchema = Joi.object(engagementBaseSchema);
const updateEngagementSchema = Joi.object(engagementBaseSchema);

module.exports = { createEngagementSchema, updateEngagementSchema };
