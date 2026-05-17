'use strict';

const Joi = require('joi');

const STATUSES = ['not_provided', 'seen', 'partial', 'requested'];

const updateEvidenceSchema = Joi.object({
  status: Joi.string().valid(...STATUSES),
  notes: Joi.string().allow(null, ''),           // verbal evidence / session notes
  documentNotes: Joi.string().allow(null, ''),   // documents produced (US-021)
  documentLink: Joi.string().uri().allow(null, ''), // URL link to document (US-021)
}).min(1);

module.exports = { updateEvidenceSchema };
