'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const asyncHandler = require('../utils/asyncHandler');
const evidenceController = require('../controllers/evidenceController');
const { requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createEvidenceItemSchema,
  updateEvidenceItemSchema,
} = require('../validations/evidenceValidation');

// POST /api/v1/engagements/:engagementId/evidence-items
router.post(
  '/',
  requirePermission('assessments:start'),
  validate(createEvidenceItemSchema),
  asyncHandler(evidenceController.createEvidenceItem),
);

// PATCH /api/v1/evidence-items/:itemId  (mounted separately in index.js)
router.patch(
  '/:itemId',
  requirePermission('assessments:start'),
  validate(updateEvidenceItemSchema),
  asyncHandler(evidenceController.updateEvidenceItem),
);

// GET /api/v1/engagements/:engagementId/controls/:controlId/evidence-status
router.get(
  '/controls/:controlId/evidence-status',
  requirePermission('assessments:read'),
  asyncHandler(evidenceController.getControlEvidenceStatus),
);

module.exports = router;
