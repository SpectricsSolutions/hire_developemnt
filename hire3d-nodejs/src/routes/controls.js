'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controlsController = require('../controllers/controlsController');
const { requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createControlTemplateSchema,
  updateControlTemplateSchema,
  upsertAnchorSchema,
  updateAnchorSchema,
} = require('../validations/controlsValidation');

// Control templates
router.get('/control-templates', requirePermission('controls:read'), asyncHandler(controlsController.listControlTemplates));
router.get('/control-templates/:templateId', requirePermission('controls:read'), asyncHandler(controlsController.getControlTemplate));
router.post('/control-templates', requirePermission('controls:manage'), validate(createControlTemplateSchema), asyncHandler(controlsController.createControlTemplate));
router.put('/control-templates/:templateId', requirePermission('controls:manage'), validate(updateControlTemplateSchema), asyncHandler(controlsController.updateControlTemplate));
router.delete('/control-templates/:templateId', requirePermission('controls:manage'), asyncHandler(controlsController.deleteControlTemplate));

// Calibration anchors
router.put('/control-templates/:templateId/calibration-anchors', requirePermission('controls:manage'), validate(upsertAnchorSchema), asyncHandler(controlsController.upsertCalibrationAnchor));
router.put('/calibration-anchors/:anchorId', requirePermission('controls:manage'), validate(updateAnchorSchema), asyncHandler(controlsController.updateCalibrationAnchor));
router.delete('/calibration-anchors/:anchorId', requirePermission('controls:manage'), asyncHandler(controlsController.deleteCalibrationAnchor));

module.exports = router;
