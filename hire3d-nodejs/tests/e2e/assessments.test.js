'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { cleanTables } = require('../helpers/db');
const { createUser, createClient, createEngagement, DEFAULT_PASSWORD } = require('../helpers/factories');

afterEach(cleanTables);

async function loginAs(user) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: DEFAULT_PASSWORD });
  return res.body.data.accessToken;
}

// Engagement where both hard gates pass (letter signed + invoice raised).
async function makeGatedEngagement(operatorId) {
  const client = await createClient({ assignedOperatorId: operatorId });
  return createEngagement(client.id, {
    engagementLetterSignedAt: '2026-01-10',
    invoiceRaisedAt: '2026-01-15',
  });
}

// Engagement where no gates pass.
async function makeBlockedEngagement(operatorId) {
  const client = await createClient({
    assignedOperatorId: operatorId,
    companyName: 'Blocked Co',
    primaryContactEmail: 'blocked@ex.com',
  });
  return createEngagement(client.id);
}

// ──────────────────────────────────────────────────────────────────────────────
// Gate report
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/engagements/:engagementId/gates', () => {
  test('returns gate status for an engagement', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeGatedEngagement(op.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/engagements/${engagement.id}/gates`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gates).toBeInstanceOf(Array);
    expect(res.body.data.engagementId).toBe(engagement.id);
    expect(res.body.data.gates.every((g) => 'passed' in g)).toBe(true);
  });

  test('requires authentication', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeGatedEngagement(op.id);

    const res = await request(app).get(`/api/v1/engagements/${engagement.id}/gates`);
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Get current assessment
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/engagements/:engagementId/assessment', () => {
  test('returns null when no assessment started', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeGatedEngagement(op.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/engagements/${engagement.id}/assessment`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Start assessment
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/engagements/:engagementId/assessment/start', () => {
  test('starts an assessment when gates pass', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeGatedEngagement(op.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.phase).toBe('PHASE_1_IN_PROGRESS');
    expect(res.body.data.engagementId).toBe(engagement.id);
  });

  test('blocked when engagement letter not signed — 422', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeBlockedEngagement(op.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty('ENGAGEMENT_LETTER_SIGNED');
    expect(res.body.errors).toHaveProperty('INVOICE_RAISED');
  });

  test('blocked when only invoice not raised — 422', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({
      assignedOperatorId: op.id,
      companyName: 'Partial Co',
      primaryContactEmail: 'partial@ex.com',
    });
    const engagement = await createEngagement(client.id, {
      engagementLetterSignedAt: '2026-01-10',
    });

    const token = await loginAs(admin);
    const res = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty('INVOICE_RAISED');
    expect(res.body.errors).not.toHaveProperty('ENGAGEMENT_LETTER_SIGNED');
  });

  test('cannot start a second active assessment — 409', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeGatedEngagement(op.id);

    const token = await loginAs(admin);
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const res2 = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    expect(res2.status).toBe(409);
  });

  test('gate checks are recorded even when blocked', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeBlockedEngagement(op.id);

    const token = await loginAs(admin);
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const checksRes = await request(app)
      .get(`/api/v1/engagements/${engagement.id}/gate-checks`)
      .set('Authorization', `Bearer ${token}`);

    expect(checksRes.status).toBe(200);
    expect(checksRes.body.data.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Full phase lifecycle: start → close phase 1 → submit phase 2
// ──────────────────────────────────────────────────────────────────────────────

describe('Assessment phase lifecycle', () => {
  let admin, adminToken, engagement;

  beforeEach(async () => {
    admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    engagement = await makeGatedEngagement(op.id);
    adminToken = await loginAs(admin);
  });

  async function startAssessment() {
    const res = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${adminToken}`);
    return res.body.data;
  }

  test('close phase 1 transitions to PHASE_1_CLOSED', async () => {
    const assessment = await startAssessment();

    const res = await request(app)
      .post(`/api/v1/assessments/${assessment.id}/close-phase-1`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.phase).toBe('PHASE_1_CLOSED');
  });

  test('cannot close phase 1 twice — 409', async () => {
    const assessment = await startAssessment();
    await request(app)
      .post(`/api/v1/assessments/${assessment.id}/close-phase-1`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res2 = await request(app)
      .post(`/api/v1/assessments/${assessment.id}/close-phase-1`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res2.status).toBe(409);
  });

  test('submit phase 2 transitions to PHASE_2_SUBMITTED', async () => {
    const assessment = await startAssessment();
    await request(app)
      .post(`/api/v1/assessments/${assessment.id}/close-phase-1`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/api/v1/assessments/${assessment.id}/submit-phase-2`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.phase).toBe('PHASE_2_SUBMITTED');
  });

  test('cannot submit phase 2 while phase 1 is still open — 409', async () => {
    const assessment = await startAssessment();

    const res = await request(app)
      .post(`/api/v1/assessments/${assessment.id}/submit-phase-2`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  test('cancel transitions to CANCELLED', async () => {
    const assessment = await startAssessment();

    const res = await request(app)
      .post(`/api/v1/assessments/${assessment.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.phase).toBe('CANCELLED');
  });

  test('cannot cancel a submitted assessment — 409', async () => {
    const assessment = await startAssessment();
    await request(app)
      .post(`/api/v1/assessments/${assessment.id}/close-phase-1`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .post(`/api/v1/assessments/${assessment.id}/submit-phase-2`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/api/v1/assessments/${assessment.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  test('assessment state is readable after start', async () => {
    await startAssessment();

    const res = await request(app)
      .get(`/api/v1/engagements/${engagement.id}/assessment`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.phase).toBe('PHASE_1_IN_PROGRESS');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Permission checks
// ──────────────────────────────────────────────────────────────────────────────

describe('Assessment permission checks', () => {
  test('viewer cannot start an assessment — 403', async () => {
    const viewer = await createUser({ roleName: 'VIEWER' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeGatedEngagement(op.id);

    const token = await loginAs(viewer);
    const res = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('unauthenticated request — 401', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await makeGatedEngagement(op.id);

    const res = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`);

    expect(res.status).toBe(401);
  });
});
