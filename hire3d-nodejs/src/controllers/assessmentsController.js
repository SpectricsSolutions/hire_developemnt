'use strict';

const assessmentsService = require('../services/assessmentsService');
const { success } = require('../utils/response');

function toRead(assessment) {
  const data = assessment.toJSON ? assessment.toJSON() : { ...assessment };
  return { ...data, phase: assessmentsService.derivePhase(assessment) };
}

async function scheduleAudit(req, res) {
  const report = await assessmentsService.scheduleAudit(req.params.engagementId);
  return success(res, report, 'Gate check complete.');
}

async function getEngagementGates(req, res) {
  const report = await assessmentsService.gateReport(req.params.engagementId);
  return success(res, report);
}

async function getEngagementAssessment(req, res) {
  const assessment = await assessmentsService.getForEngagement(req.params.engagementId);
  if (!assessment) {
    return success(res, null, 'No assessment has been started for this engagement.');
  }
  return success(res, toRead(assessment));
}

async function startAssessment(req, res) {
  const assessment = await assessmentsService.startAssessment(req.params.engagementId, req.user.id);
  return success(res, toRead(assessment), 'Phase 1 started.', 201);
}

async function closePhase1(req, res) {
  const assessment = await assessmentsService.closePhase1(req.params.assessmentId, req.user.id);
  return success(res, toRead(assessment), 'Phase 1 closed. Phase 2 is now available.');
}

async function submitPhase2(req, res) {
  const assessment = await assessmentsService.submitPhase2(req.params.assessmentId, req.user.id);
  return success(res, toRead(assessment), 'Phase 2 submitted.');
}

async function cancelAssessment(req, res) {
  const assessment = await assessmentsService.cancelAssessment(req.params.assessmentId, req.user.id);
  return success(res, toRead(assessment), 'Assessment cancelled.');
}

async function listGateChecks(req, res) {
  const checks = await assessmentsService.listGateChecks(req.params.engagementId);
  return success(res, checks.map((c) => c.toJSON()));
}

module.exports = {
  scheduleAudit,
  getEngagementGates,
  getEngagementAssessment,
  startAssessment,
  closePhase1,
  submitPhase2,
  cancelAssessment,
  listGateChecks,
};
