'use strict';

const Joi = require('joi');

const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];

const auditQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
  action: Joi.string().valid(...AUDIT_ACTIONS).allow(null).default(null),
  resourceType: Joi.string().max(50).allow(null).default(null),
  actorId: Joi.string().uuid().allow(null).default(null),
  before: Joi.date().iso().allow(null).default(null),
  after: Joi.date().iso().allow(null).default(null),
});

module.exports = { auditQuerySchema };
