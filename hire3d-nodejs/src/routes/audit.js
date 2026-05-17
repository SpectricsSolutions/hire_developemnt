'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const auditController = require('../controllers/auditController');
const { requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { auditQuerySchema } = require('../validations/auditValidation');

router.get('/', requirePermission('audit:read'), validate(auditQuerySchema, 'query'), asyncHandler(auditController.listAuditLogs));

module.exports = router;
