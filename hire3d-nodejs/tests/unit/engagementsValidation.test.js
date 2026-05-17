'use strict';

const { createEngagementSchema, updateEngagementSchema } = require('../../src/validations/engagementsValidation');

const BASE = {
  product: 'HIRE_3D_CORE',
  engagementDate: '2026-01-15',
  feeCharged: 2000,
  feeStatus: 'INVOICED',
  auditStatus: 'SCHEDULED',
};

function validate(schema, overrides) {
  return schema.validate({ ...BASE, ...overrides }, { abortEarly: false });
}

describe('createEngagementSchema — cross-field date validators', () => {
  test('accepts payload with no optional dates', () => {
    const { error } = validate(createEngagementSchema, {});
    expect(error).toBeUndefined();
  });

  test('accepts valid date ordering', () => {
    const { error } = validate(createEngagementSchema, {
      auditDate: '2026-02-01',
      reportIssuedDate: '2026-03-01',
      nextReviewDue: '2027-01-15',
    });
    expect(error).toBeUndefined();
  });

  test('accepts report issued on same day as audit date', () => {
    const { error } = validate(createEngagementSchema, {
      auditDate: '2026-02-01',
      reportIssuedDate: '2026-02-01',
    });
    expect(error).toBeUndefined();
  });

  test('accepts audit date equal to engagement date', () => {
    const { error } = validate(createEngagementSchema, { auditDate: '2026-01-15' });
    expect(error).toBeUndefined();
  });

  describe('auditDate', () => {
    test('rejects audit_date before engagement_date', () => {
      const { error } = validate(createEngagementSchema, { auditDate: '2025-12-31' });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/audit date/i);
    });

    test('audit_date can be null', () => {
      const { error } = validate(createEngagementSchema, { auditDate: null });
      expect(error).toBeUndefined();
    });
  });

  describe('reportIssuedDate', () => {
    test('rejects report_issued_date before audit_date', () => {
      const { error } = validate(createEngagementSchema, {
        auditDate: '2026-03-01',
        reportIssuedDate: '2026-02-01',
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/report issued date/i);
    });

    test('rejects report_issued_date before engagement_date when no audit_date', () => {
      const { error } = validate(createEngagementSchema, {
        reportIssuedDate: '2025-12-31',
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/report issued date/i);
    });

    test('accepts report_issued_date on or after engagement_date when no audit_date', () => {
      const { error } = validate(createEngagementSchema, {
        reportIssuedDate: '2026-01-15',
      });
      expect(error).toBeUndefined();
    });

    test('report_issued_date can be null', () => {
      const { error } = validate(createEngagementSchema, { reportIssuedDate: null });
      expect(error).toBeUndefined();
    });
  });

  describe('nextReviewDue', () => {
    test('rejects next_review_due before engagement_date', () => {
      const { error } = validate(createEngagementSchema, { nextReviewDue: '2025-12-31' });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/next review due/i);
    });

    test('accepts next_review_due equal to engagement_date', () => {
      const { error } = validate(createEngagementSchema, { nextReviewDue: '2026-01-15' });
      expect(error).toBeUndefined();
    });

    test('next_review_due can be null', () => {
      const { error } = validate(createEngagementSchema, { nextReviewDue: null });
      expect(error).toBeUndefined();
    });
  });
});

describe('updateEngagementSchema — same cross-field rules apply', () => {
  test('rejects audit_date before engagement_date', () => {
    const { error } = validate(updateEngagementSchema, { auditDate: '2025-01-01' });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/audit date/i);
  });

  test('accepts valid update payload', () => {
    const { error } = validate(updateEngagementSchema, {
      auditDate: '2026-06-01',
      reportIssuedDate: '2026-07-01',
      nextReviewDue: '2027-01-15',
    });
    expect(error).toBeUndefined();
  });
});

describe('field-level validation', () => {
  test('rejects unknown product', () => {
    const { error } = validate(createEngagementSchema, { product: 'INVALID' });
    expect(error).toBeDefined();
  });

  test('rejects negative feeCharged', () => {
    const { error } = validate(createEngagementSchema, { feeCharged: -1 });
    expect(error).toBeDefined();
  });

  test('rejects invalid date format for engagementDate', () => {
    const { error } = validate(createEngagementSchema, { engagementDate: '15-01-2026' });
    expect(error).toBeDefined();
  });

  test('rejects unknown feeStatus', () => {
    const { error } = validate(createEngagementSchema, { feeStatus: 'UNKNOWN' });
    expect(error).toBeDefined();
  });
});
