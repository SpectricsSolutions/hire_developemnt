'use strict';

const Joi = require('joi');

const PRODUCTS = ['HIRE_READY', 'THE_CHECK', 'HIRE_3D_CORE', 'HIRE_3D_ENHANCED'];
const DOMAINS = ['A', 'B', 'C'];
const RAG_LEVELS = ['RED', 'AMBER_RED', 'AMBER', 'GREEN_AMBER', 'GREEN'];

const calibrationAnchorSchema = Joi.object({
  ragLevel: Joi.string().valid(...RAG_LEVELS).required(),
  description: Joi.string().min(1).required(),
  severityHint: Joi.number().integer().min(1).max(5).allow(null).default(null),
});

const createControlTemplateSchema = Joi.object({
  product: Joi.string().valid(...PRODUCTS).required(),
  domain: Joi.string().valid(...DOMAINS).allow(null).default(null),
  code: Joi.string().min(1).max(10).required(),
  title: Joi.string().min(1).max(255).required(),
  whatTesting: Joi.string().min(1).required(),
  whyMatters: Joi.string().min(1).required(),
  primaryQuestion: Joi.string().min(1).required(),
  evidencePrompts: Joi.array().items(Joi.string()).default([]),
  lookingFor: Joi.array().items(Joi.string()).default([]),
  sampling: Joi.string().allow(null, '').default(null),
  ifPartial: Joi.array().items(Joi.string()).default([]),
  sortOrder: Joi.number().integer().default(0),
  isActive: Joi.boolean().default(true),
  calibrationAnchors: Joi.array().items(calibrationAnchorSchema).default([]),
});

const updateControlTemplateSchema = Joi.object({
  product: Joi.string().valid(...PRODUCTS).required(),
  domain: Joi.string().valid(...DOMAINS).allow(null).default(null),
  code: Joi.string().min(1).max(10).required(),
  title: Joi.string().min(1).max(255).required(),
  whatTesting: Joi.string().min(1).required(),
  whyMatters: Joi.string().min(1).required(),
  primaryQuestion: Joi.string().min(1).required(),
  evidencePrompts: Joi.array().items(Joi.string()).default([]),
  lookingFor: Joi.array().items(Joi.string()).default([]),
  sampling: Joi.string().allow(null, '').default(null),
  ifPartial: Joi.array().items(Joi.string()).default([]),
  sortOrder: Joi.number().integer().default(0),
  isActive: Joi.boolean().default(true),
  calibrationAnchors: Joi.array().items(calibrationAnchorSchema).allow(null).default(null),
});

const upsertAnchorSchema = calibrationAnchorSchema;
const updateAnchorSchema = calibrationAnchorSchema;

module.exports = {
  createControlTemplateSchema,
  updateControlTemplateSchema,
  upsertAnchorSchema,
  updateAnchorSchema,
};
