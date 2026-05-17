'use strict';

const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(1).max(256).required(),
});

const totpVerifySchema = Joi.object({
  code: Joi.string().pattern(/^\d{6}$/).required(),
});

const totpConfirmSchema = Joi.object({
  totpToken: Joi.string().min(1).max(512).required(),
  code: Joi.string().pattern(/^\d{6}$/).required(),
});

module.exports = { loginSchema, totpVerifySchema, totpConfirmSchema };
