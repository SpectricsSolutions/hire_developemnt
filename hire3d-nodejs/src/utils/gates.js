'use strict';

const GateName = {
  ENGAGEMENT_LETTER_SIGNED: 'ENGAGEMENT_LETTER_SIGNED',
  INVOICE_RAISED: 'INVOICE_RAISED',
  NO_RAG_DURING_PHASE_1: 'NO_RAG_DURING_PHASE_1',
  PHASE_1_CLOSED: 'PHASE_1_CLOSED',
  PHASE_2_MANDATORY_FIELDS_COMPLETE: 'PHASE_2_MANDATORY_FIELDS_COMPLETE',
  QA_SIGN_OFF: 'QA_SIGN_OFF',
  ADMIN_REPORT_REVIEW: 'ADMIN_REPORT_REVIEW',
};

function evaluateEngagementLetter({ engagement }) {
  if (!engagement.engagementLetterSignedAt) {
    return [GateName.ENGAGEMENT_LETTER_SIGNED, false, 'Engagement letter not yet recorded as signed.'];
  }
  return [GateName.ENGAGEMENT_LETTER_SIGNED, true, null];
}

function evaluateInvoiceRaised({ engagement }) {
  if (!engagement.invoiceRaisedAt) {
    return [GateName.INVOICE_RAISED, false, 'Invoice has not been raised against this engagement.'];
  }
  return [GateName.INVOICE_RAISED, true, null];
}

function evaluateNoRagDuringPhase1() {
  return [GateName.NO_RAG_DURING_PHASE_1, true, null];
}

function evaluatePhase1Closed({ assessment }) {
  if (!assessment || !assessment.phase1ClosedAt) {
    return [GateName.PHASE_1_CLOSED, false, 'Phase 1 must be actively closed before Phase 2 can be opened.'];
  }
  return [GateName.PHASE_1_CLOSED, true, null];
}

function evaluatePhase2MandatoryFields() {
  return [GateName.PHASE_2_MANDATORY_FIELDS_COMPLETE, true, null];
}

const START_GATES = [evaluateEngagementLetter, evaluateInvoiceRaised];
const CLOSE_PHASE_1_GATES = [evaluateNoRagDuringPhase1];
const SUBMIT_PHASE_2_GATES = [evaluatePhase1Closed, evaluatePhase2MandatoryFields];
const REPORT_GATES = [
  evaluateEngagementLetter,
  evaluateInvoiceRaised,
  evaluateNoRagDuringPhase1,
  evaluatePhase1Closed,
  evaluatePhase2MandatoryFields,
];

function runGates(evaluators, inputs) {
  return evaluators.map((fn) => fn(inputs));
}

module.exports = {
  GateName,
  START_GATES,
  CLOSE_PHASE_1_GATES,
  SUBMIT_PHASE_2_GATES,
  REPORT_GATES,
  runGates,
  evaluateEngagementLetter,
  evaluateInvoiceRaised,
  evaluateNoRagDuringPhase1,
  evaluatePhase1Closed,
  evaluatePhase2MandatoryFields,
};
