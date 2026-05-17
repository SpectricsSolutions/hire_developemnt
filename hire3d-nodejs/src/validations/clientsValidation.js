'use strict';

const Joi = require('joi');

const CLIENT_STATUSES = ['ACTIVE', 'AUDIT_IN_PROGRESS', 'REPORT_ISSUED', 'FOLLOW_UP_DUE', 'INACTIVE'];
const BUSINESS_STAGES = ['PRE_HIRE', 'EARLY', 'GROWTH', 'ESTABLISHED'];
const UK_REGIONS = [
  'EAST_MIDLANDS', 'EAST_OF_ENGLAND', 'LONDON', 'NORTH_EAST', 'NORTH_WEST',
  'SOUTH_EAST', 'SOUTH_WEST', 'WEST_MIDLANDS', 'YORKSHIRE_AND_THE_HUMBER',
  'NORTHERN_IRELAND', 'SCOTLAND', 'WALES',
];

const clientBaseSchema = {
  companyName: Joi.string().min(1).max(255).required(),
  companiesHouseNumber: Joi.string().min(1).max(50).allow(null).default(null),
  primaryContactName: Joi.string().min(1).max(100).required(),
  primaryContactEmail: Joi.string().email().max(255).required(),
  primaryContactPhone: Joi.string().allow(null).default(null),
  sector: Joi.string().min(1).max(100).allow(null).default(null),
  headcountAtEngagement: Joi.number().integer().min(0).max(10000000).required(),
  currentHeadcount: Joi.number().integer().min(0).max(10000000).allow(null).default(null),
  businessStage: Joi.string().valid(...BUSINESS_STAGES).required(),
  region: Joi.string().valid(...UK_REGIONS).required(),
  assignedOperatorId: Joi.string().uuid().required(),
  internalNotes: Joi.string().allow(null, '').default(null),
  introducerFeeApplicable: Joi.boolean().allow(null).default(null),
  status: Joi.string().valid(...CLIENT_STATUSES).required(),
};

const createClientSchema = Joi.object({
  ...clientBaseSchema,
  status: Joi.string().valid(...CLIENT_STATUSES).default('ACTIVE'),
});

const updateClientSchema = Joi.object(clientBaseSchema);

module.exports = { createClientSchema, updateClientSchema };
