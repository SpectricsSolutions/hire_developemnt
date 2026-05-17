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

const createEngagementSchema = Joi.object(engagementBaseSchema).custom((value, helpers) => {
  const { engagementDate, auditDate, reportIssuedDate, nextReviewDue } = value;

  if (auditDate && auditDate < engagementDate) {
    return helpers.error('any.invalid', { message: 'Audit date must be on or after the engagement date.' });
  }

  if (reportIssuedDate) {
    const boundary = auditDate || engagementDate;
    if (reportIssuedDate < boundary) {
      return helpers.error('any.invalid', {
        message: 'Report issued date must be on or after the audit date (or engagement date if no audit date is set).',
      });
    }
  }

  if (nextReviewDue && nextReviewDue < engagementDate) {
    return helpers.error('any.invalid', { message: 'Next review due must be on or after the engagement date.' });
  }

  return value;
}).messages({ 'any.invalid': '{{#message}}' });

const updateEngagementSchema = Joi.object(engagementBaseSchema).custom((value, helpers) => {
  const { engagementDate, auditDate, reportIssuedDate, nextReviewDue } = value;

  if (auditDate && auditDate < engagementDate) {
    return helpers.error('any.invalid', { message: 'Audit date must be on or after the engagement date.' });
  }

  if (reportIssuedDate) {
    const boundary = auditDate || engagementDate;
    if (reportIssuedDate < boundary) {
      return helpers.error('any.invalid', {
        message: 'Report issued date must be on or after the audit date (or engagement date if no audit date is set).',
      });
    }
  }

  if (nextReviewDue && nextReviewDue < engagementDate) {
    return helpers.error('any.invalid', { message: 'Next review due must be on or after the engagement date.' });
  }

  return value;
}).messages({ 'any.invalid': '{{#message}}' });

module.exports = { createEngagementSchema, updateEngagementSchema };
