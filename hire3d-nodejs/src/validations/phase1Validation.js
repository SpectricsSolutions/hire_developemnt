'use strict';

const Joi = require('joi');

const STATUSES = ['not_provided', 'seen', 'partial', 'requested'];

const updateEvidenceSchema = Joi.object({
  status: Joi.string().valid(...STATUSES),
  notes: Joi.string().allow(null, ''),
}).min(1);

module.exports = { updateEvidenceSchema };
