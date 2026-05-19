'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const assessmentsController = require('../controllers/assessmentsController');
const { requirePermission } = require('../middleware/auth');

// Engagement-scoped
router.get('/engagements/:engagementId/gates', requirePermission('assessments:read'), asyncHandler(assessmentsController.getEngagementGates));
router.get('/engagements/:engagementId/assessment', requirePermission('assessments:read'), asyncHandler(assessmentsController.getEngagementAssessment));
router.post('/engagements/:engagementId/assessment/schedule', requirePermission('assessments:start'), asyncHandler(assessmentsController.scheduleAudit));
router.post('/engagements/:engagementId/assessment/start', requirePermission('assessments:start'), asyncHandler(assessmentsController.startAssessment));
router.get('/engagements/:engagementId/gate-checks', requirePermission('assessments:read'), asyncHandler(assessmentsController.listGateChecks));

// Assessment-scoped
router.post('/assessments/:assessmentId/close-phase-1', requirePermission('assessments:close_phase_1'), asyncHandler(assessmentsController.closePhase1));
router.post('/assessments/:assessmentId/submit-phase-2', requirePermission('assessments:submit_phase_2'), asyncHandler(assessmentsController.submitPhase2));
router.post('/assessments/:assessmentId/cancel', requirePermission('assessments:cancel'), asyncHandler(assessmentsController.cancelAssessment));

module.exports = router;
