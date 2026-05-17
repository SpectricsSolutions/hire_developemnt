'use strict';

const {
  GateName,
  START_GATES,
  CLOSE_PHASE_1_GATES,
  SUBMIT_PHASE_2_GATES,
  runGates,
  evaluateEngagementLetter,
  evaluateInvoiceRaised,
  evaluateNoRagDuringPhase1,
  evaluatePhase1Closed,
  evaluatePhase2MandatoryFields,
} = require('../../src/utils/gates');

function makeEngagement({ engagementLetterSignedAt = null, invoiceRaisedAt = null } = {}) {
  return { engagementLetterSignedAt, invoiceRaisedAt };
}

function makeAssessment({ phase1ClosedAt = null } = {}) {
  return { phase1ClosedAt };
}

describe('evaluateEngagementLetter', () => {
  test('passes when signed', () => {
    const [gate, passed, reason] = evaluateEngagementLetter({
      engagement: makeEngagement({ engagementLetterSignedAt: '2026-05-01' }),
    });
    expect(gate).toBe(GateName.ENGAGEMENT_LETTER_SIGNED);
    expect(passed).toBe(true);
    expect(reason).toBeNull();
  });

  test('fails when not signed', () => {
    const [gate, passed, reason] = evaluateEngagementLetter({
      engagement: makeEngagement({ engagementLetterSignedAt: null }),
    });
    expect(gate).toBe(GateName.ENGAGEMENT_LETTER_SIGNED);
    expect(passed).toBe(false);
    expect(reason).toMatch(/signed/i);
  });
});

describe('evaluateInvoiceRaised', () => {
  test('passes when invoice raised', () => {
    const [gate, passed, reason] = evaluateInvoiceRaised({
      engagement: makeEngagement({ invoiceRaisedAt: '2026-05-02' }),
    });
    expect(gate).toBe(GateName.INVOICE_RAISED);
    expect(passed).toBe(true);
    expect(reason).toBeNull();
  });

  test('fails when not raised', () => {
    const [, passed, reason] = evaluateInvoiceRaised({
      engagement: makeEngagement({ invoiceRaisedAt: null }),
    });
    expect(passed).toBe(false);
    expect(reason).toMatch(/invoice/i);
  });
});

describe('evaluateNoRagDuringPhase1', () => {
  test('always passes (structural enforcement)', () => {
    const [gate, passed, reason] = evaluateNoRagDuringPhase1({
      engagement: makeEngagement(),
      assessment: makeAssessment(),
    });
    expect(gate).toBe(GateName.NO_RAG_DURING_PHASE_1);
    expect(passed).toBe(true);
    expect(reason).toBeNull();
  });
});

describe('evaluatePhase1Closed', () => {
  test('passes when phase 1 is closed', () => {
    const [gate, passed, reason] = evaluatePhase1Closed({
      engagement: makeEngagement(),
      assessment: makeAssessment({ phase1ClosedAt: new Date() }),
    });
    expect(gate).toBe(GateName.PHASE_1_CLOSED);
    expect(passed).toBe(true);
    expect(reason).toBeNull();
  });

  test('fails when assessment is null', () => {
    const [, passed, reason] = evaluatePhase1Closed({
      engagement: makeEngagement(),
      assessment: null,
    });
    expect(passed).toBe(false);
    expect(reason).toMatch(/phase 1/i);
  });

  test('fails when phase 1 not yet closed', () => {
    const [, passed] = evaluatePhase1Closed({
      engagement: makeEngagement(),
      assessment: makeAssessment({ phase1ClosedAt: null }),
    });
    expect(passed).toBe(false);
  });
});

describe('evaluatePhase2MandatoryFields', () => {
  test('always passes (placeholder until Phase C findings ship)', () => {
    const [, passed] = evaluatePhase2MandatoryFields({
      engagement: makeEngagement(),
      assessment: makeAssessment(),
    });
    expect(passed).toBe(true);
  });
});

describe('runGates', () => {
  test('runs each evaluator in order and collects results', () => {
    const results = runGates(START_GATES, {
      engagement: makeEngagement(),
      assessment: null,
    });
    expect(results).toHaveLength(2);
    expect(results[0][0]).toBe(GateName.ENGAGEMENT_LETTER_SIGNED);
    expect(results[1][0]).toBe(GateName.INVOICE_RAISED);
  });

  test('START_GATES: both fail when nothing is set', () => {
    const results = runGates(START_GATES, { engagement: makeEngagement() });
    expect(results.every(([, passed]) => !passed)).toBe(true);
  });

  test('START_GATES: both pass when letter and invoice are set', () => {
    const results = runGates(START_GATES, {
      engagement: makeEngagement({
        engagementLetterSignedAt: '2026-01-01',
        invoiceRaisedAt: '2026-01-02',
      }),
    });
    expect(results.every(([, passed]) => passed)).toBe(true);
  });

  test('CLOSE_PHASE_1_GATES: always passes (structural)', () => {
    const results = runGates(CLOSE_PHASE_1_GATES, {
      engagement: makeEngagement(),
      assessment: makeAssessment(),
    });
    expect(results.every(([, passed]) => passed)).toBe(true);
  });

  test('SUBMIT_PHASE_2_GATES: passes when phase 1 closed', () => {
    const results = runGates(SUBMIT_PHASE_2_GATES, {
      engagement: makeEngagement(),
      assessment: makeAssessment({ phase1ClosedAt: new Date() }),
    });
    expect(results.every(([, passed]) => passed)).toBe(true);
  });

  test('SUBMIT_PHASE_2_GATES: fails when phase 1 still open', () => {
    const results = runGates(SUBMIT_PHASE_2_GATES, {
      engagement: makeEngagement(),
      assessment: makeAssessment({ phase1ClosedAt: null }),
    });
    expect(results.some(([, passed]) => !passed)).toBe(true);
  });
});
