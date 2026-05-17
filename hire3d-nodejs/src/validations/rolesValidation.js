'use strict';

const Joi = require('joi');

const createRoleSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().allow(null, '').default(null),
  permissions: Joi.array().items(Joi.string()).default([]),
});

const updateRoleSchema = Joi.object({
  name: Joi.string().min(1).max(100).allow(null).default(null),
  description: Joi.string().allow(null, '').default(null),
  permissions: Joi.array().items(Joi.string()).allow(null).default(null),
});

module.exports = { createRoleSchema, updateRoleSchema };
