'use strict';

const Joi = require('joi');

const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'];

const createUserSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().max(100).allow(null).default(null),
  status: Joi.string().valid(...USER_STATUSES).allow(null).default(null),
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(1).max(50).allow(null).default(null),
  role: Joi.string().max(100).allow(null).default(null),
  status: Joi.string().valid(...USER_STATUSES).allow(null).default(null),
});

module.exports = { createUserSchema, updateUserSchema };
