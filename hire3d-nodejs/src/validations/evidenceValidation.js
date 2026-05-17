'use strict';

const Joi = require('joi');

const STATUSES = ['seen', 'requested', 'not_provided', 'partial'];

const createEvidenceItemSchema = Joi.object({
  controlId: Joi.string().uuid().required(),
  status: Joi.string().valid(...STATUSES).required(),
  description: Joi.string().min(1).allow(null, '').default(null),
  notes: Joi.string().min(1).allow(null, '').default(null),
});

const updateEvidenceItemSchema = Joi.object({
  status: Joi.string().valid(...STATUSES),
  description: Joi.string().min(1).allow(null, ''),
  notes: Joi.string().min(1).allow(null, ''),
}).min(1); // at least one field required

module.exports = { createEvidenceItemSchema, updateEvidenceItemSchema };
