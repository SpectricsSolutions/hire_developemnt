'use strict';

const { Assessment, AssessmentGateCheck, Engagement, ControlTemplate, P1Evidence } = require('../models');
const { NotFoundError, ConflictError, GateBlockedError } = require('../utils/errors');
const { logCreate, logUpdate } = require('./auditService');
const { runGates, START_GATES, CLOSE_PHASE_1_GATES, SUBMIT_PHASE_2_GATES, REPORT_GATES } = require('../utils/gates');

function derivePhase(assessment) {
  if (!assessment) return 'NOT_STARTED';
  if (assessment.cancelledAt) return 'CANCELLED';
  if (assessment.phase2SubmittedAt) return 'PHASE_2_SUBMITTED';
  if (assessment.phase1ClosedAt) return 'PHASE_1_CLOSED';
  if (assessment.phase1StartedAt) return 'PHASE_1_IN_PROGRESS';
  return 'NOT_STARTED';
}

async function getEngagement(engagementId) {
  const engagement = await Engagement.findByPk(engagementId);
  if (!engagement) throw new NotFoundError();
  return engagement;
}

async function getForEngagement(engagementId) {
  return Assessment.findOne({ where: { engagementId } });
}

async function getById(assessmentId) {
  const assessment = await Assessment.findByPk(assessmentId);
  if (!assessment) throw new NotFoundError();
  return assessment;
}

async function recordGateChecks({ engagementId, assessmentId = null, actorId = null, results }) {
  const now = new Date();
  await AssessmentGateCheck.bulkCreate(
    results.map(([gate, passed, reason]) => ({
      assessmentId,
      engagementId,
      gate,
      passed,
      reason,
      checkedAt: now,
      actorId,
    })),
  );
}

function raiseIfBlocked(results, message) {
  const failed = {};
  for (const [gate, passed, reason] of results) {
    if (!passed) failed[gate] = reason;
  }
  if (Object.keys(failed).length > 0) throw new GateBlockedError(message, failed);
}

async function gateReport(engagementId) {
  const engagement = await getEngagement(engagementId);
  const assessment = await getForEngagement(engagementId);
  const inputs = { engagement, assessment };

  const results = runGates(REPORT_GATES, inputs);
  return {
    engagementId,
    assessmentId: assessment ? assessment.id : null,
    gates: results.map(([gate, passed, reason]) => ({ gate, passed, reason })),
  };
}

async function startAssessment(engagementId, actorId) {
  const engagement = await getEngagement(engagementId);
  const existing = await getForEngagement(engagementId);

  if (existing && !existing.cancelledAt) {
    throw new ConflictError('An assessment is already in progress for this engagement.');
  }

  const results = runGates(START_GATES, { engagement, assessment: null });
  await recordGateChecks({ engagementId, actorId, results });
  raiseIfBlocked(results, 'Cannot start assessment: hard gates failed.');

  const assessment = await Assessment.create({
    engagementId,
    phase1StartedAt: new Date(),
    phase1StartedById: actorId,
  });

  await Engagement.update({ auditStatus: 'SCHEDULED' }, { where: { id: engagementId } });

  // T3.01: Auto-create one p1_evidence row per active control for this product.
  // ignoreDuplicates protects against re-starting after a cancelled assessment.
  const controls = await ControlTemplate.findAll({
    where: { product: engagement.product, isActive: true },
    attributes: ['id'],
  });
  if (controls.length > 0) {
    await P1Evidence.bulkCreate(
      controls.map((c) => ({ engagementId, controlId: c.id, status: 'not_provided' })),
      { ignoreDuplicates: true },
    );
  }

  await logCreate(
    { type: 'assessment', id: assessment.id },
    { engagementId, phase1StartedAt: assessment.phase1StartedAt },
  );

  return assessment;
}

async function closePhase1(assessmentId, actorId) {
  const assessment = await getById(assessmentId);
  if (assessment.cancelledAt) throw new ConflictError('Assessment has been cancelled.');
  if (!assessment.phase1StartedAt) throw new ConflictError('Phase 1 has not been started.');
  if (assessment.phase1ClosedAt) throw new ConflictError('Phase 1 is already closed.');

  const engagement = await getEngagement(assessment.engagementId);
  const results = runGates(CLOSE_PHASE_1_GATES, { engagement, assessment });
  await recordGateChecks({ engagementId: assessment.engagementId, assessmentId, actorId, results });
  raiseIfBlocked(results, 'Cannot close Phase 1: hard gates failed.');

  const before = { phase1ClosedAt: null };
  await assessment.update({ phase1ClosedAt: new Date(), phase1ClosedById: actorId });
  await Engagement.update({ auditStatus: 'PHASE_1_COMPLETE' }, { where: { id: assessment.engagementId } });

  await logUpdate(
    { type: 'assessment', id: assessmentId },
    before,
    { phase1ClosedAt: assessment.phase1ClosedAt },
  );

  return assessment;
}

async function submitPhase2(assessmentId, actorId) {
  const assessment = await getById(assessmentId);
  if (assessment.cancelledAt) throw new ConflictError('Assessment has been cancelled.');
  if (!assessment.phase1ClosedAt) throw new ConflictError('Phase 1 must be closed before Phase 2 can be submitted.');
  if (assessment.phase2SubmittedAt) throw new ConflictError('Phase 2 has already been submitted.');

  const engagement = await getEngagement(assessment.engagementId);
  const results = runGates(SUBMIT_PHASE_2_GATES, { engagement, assessment });
  await recordGateChecks({ engagementId: assessment.engagementId, assessmentId, actorId, results });
  raiseIfBlocked(results, 'Cannot submit Phase 2: hard gates failed.');

  const before = { phase2SubmittedAt: null };
  await assessment.update({ phase2SubmittedAt: new Date(), phase2SubmittedById: actorId });
  await Engagement.update({ auditStatus: 'PHASE_2_COMPLETE' }, { where: { id: assessment.engagementId } });

  await logUpdate(
    { type: 'assessment', id: assessmentId },
    before,
    { phase2SubmittedAt: assessment.phase2SubmittedAt },
  );

  return assessment;
}

async function cancelAssessment(assessmentId, actorId) {
  const assessment = await getById(assessmentId);
  if (assessment.cancelledAt) throw new ConflictError('Assessment is already cancelled.');
  if (assessment.phase2SubmittedAt) throw new ConflictError('Cannot cancel a submitted assessment.');

  const before = { cancelledAt: null };
  await assessment.update({ cancelledAt: new Date() });

  await logUpdate(
    { type: 'assessment', id: assessmentId },
    before,
    { cancelledAt: assessment.cancelledAt },
  );

  return assessment;
}

async function listGateChecks(engagementId) {
  return AssessmentGateCheck.findAll({
    where: { engagementId },
    order: [['checked_at', 'DESC']],
  });
}

module.exports = {
  derivePhase,
  gateReport,
  getForEngagement,
  getById,
  startAssessment,
  closePhase1,
  submitPhase2,
  cancelAssessment,
  listGateChecks,
};
