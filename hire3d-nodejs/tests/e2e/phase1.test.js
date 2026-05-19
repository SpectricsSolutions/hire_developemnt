'use strict';

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../src/app');
const { cleanTables } = require('../helpers/db');
const { createUser, createClient, createEngagement, DEFAULT_PASSWORD } = require('../helpers/factories');
const { sequelize, P1Evidence } = require('../../src/models');

afterEach(cleanTables);

async function loginAs(user) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: DEFAULT_PASSWORD });
  return res.body.data.accessToken;
}

/** Create an engagement with gates passed + started assessment + p1_evidence rows. */
async function startedEngagement(operatorId) {
  const client = await createClient({ assignedOperatorId: operatorId });
  const engagement = await createEngagement(client.id, {
    engagementLetterSignedAt: '2026-01-10',
    invoiceRaisedAt: '2026-01-15',
    product: 'THE_CHECK',
  });
  return engagement;
}

// ── T3.02: Load workspace ──────────────────────────────────────────────────────

describe('GET /api/v1/phase1/:engagementId', () => {
  // Scenario 1 — happy path after assessment started
  test('SC01: returns workspace with controls and evidence after start', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const adminToken = await loginAs(admin);

    // Start the assessment (auto-creates p1_evidence rows)
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.engagementId).toBe(engagement.id);
    expect(res.body.data.product).toBe('THE_CHECK');
    expect(Array.isArray(res.body.data.controls)).toBe(true);
    expect(res.body.data.controls.length).toBeGreaterThan(0);
    expect(res.body.data.progress).toBeDefined();
    expect(res.body.data.progress.percentageComplete).toBe(0);
  });

  // Scenario 2 — no assessment started yet (evidence auto-initialised as not_provided)
  test('SC02: assessment is null and all evidence starts as not_provided before start', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    const res = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.assessment).toBeNull();
    res.body.data.controls.forEach((c) => {
      if (c.evidence) {
        expect(c.evidence.status).toBe('not_provided');
        expect(c.evidence.notes).toBeNull();
      }
    });
  });

  // Scenario 3 — unauthenticated
  test('SC03: unauthenticated → 401', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);

    const res = await request(app).get(`/api/v1/phase1/${engagement.id}`);
    expect(res.status).toBe(401);
  });

  // Scenario 4 — unknown engagement
  test('SC04: unknown engagement → 404', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const token = await loginAs(admin);

    const res = await request(app)
      .get('/api/v1/phase1/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── T3.02: Save evidence ───────────────────────────────────────────────────────

describe('PUT /api/v1/phase1-evidence/:itemId', () => {
  async function getFirstItem(engagementId, token) {
    const workspace = await request(app)
      .get(`/api/v1/phase1/${engagementId}`)
      .set('Authorization', `Bearer ${token}`);
    return workspace.body.data.controls[0].evidence;
  }

  // Scenario 5 — update status
  test('SC05: update status to seen → 200', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const item = await getFirstItem(engagement.id, token);
    const res = await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'seen' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('seen');
  });

  // Scenario 6 — update notes
  test('SC06: update notes → 200', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const item = await getFirstItem(engagement.id, token);
    const res = await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Contract provided verbally.' });

    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('Contract provided verbally.');
  });

  // Scenario 7 — partial update (only notes, no status)
  test('SC07: partial update (notes only) preserves status', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const item = await getFirstItem(engagement.id, token);

    await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'partial' });

    const res = await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Only partial docs.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('partial');
    expect(res.body.data.notes).toBe('Only partial docs.');
  });

  // Scenario 8 — invalid status value
  test('SC08: invalid status → 422', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const item = await getFirstItem(engagement.id, token);
    const res = await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rag_red' }); // RAG value — must be rejected

    expect(res.status).toBe(422);
  });

  // Scenario 9 — unknown item id
  test('SC09: unknown item → 404', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const token = await loginAs(admin);

    const res = await request(app)
      .put('/api/v1/phase1-evidence/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'seen' });

    expect(res.status).toBe(404);
  });
});

// ── T3.02: File upload ────────────────────────────────────────────────────────

describe('POST /api/v1/phase1-evidence/:itemId/upload', () => {
  async function setupWithEvidence() {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);
    const ws = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    const item = ws.body.data.controls[0].evidence;
    return { token, item, engagementId: engagement.id };
  }

  // Scenario 10 — happy path: upload a valid PDF
  test('SC10: upload valid PDF → 200, fileName and fileUrl returned', async () => {
    const { token, item } = await setupWithEvidence();
    const pdfBytes = Buffer.from('%PDF-1.4 1 0 obj<</Type /Catalog>>endobj');

    const res = await request(app)
      .post(`/api/v1/phase1-evidence/${item.id}/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdfBytes, { filename: 'contract.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.data.fileName).toBe('contract.pdf');
    expect(res.body.data.fileUrl).toBeTruthy();
  });

  // Scenario 11 — rejected MIME type → 422
  test('SC11: upload disallowed file type (.exe) → 422', async () => {
    const { token, item } = await setupWithEvidence();

    const res = await request(app)
      .post(`/api/v1/phase1-evidence/${item.id}/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/octet-stream' });

    expect(res.status).toBe(422);
  });

  // Scenario 12 — file too large (>10 MB) → 413
  test('SC12: file exceeding 10 MB limit → 413', async () => {
    const { token, item } = await setupWithEvidence();
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 0);

    const res = await request(app)
      .post(`/api/v1/phase1-evidence/${item.id}/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bigBuffer, { filename: 'huge.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(413);
  }, 15000);

  // Scenario 13 — file upload auto-sets status to 'seen' when previously not_provided
  test('SC13: uploading a file auto-updates status to seen when status was not_provided', async () => {
    const { token, item, engagementId } = await setupWithEvidence();
    expect(item.status).toBe('not_provided');

    await request(app)
      .post(`/api/v1/phase1-evidence/${item.id}/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    const ws = await request(app)
      .get(`/api/v1/phase1/${engagementId}`)
      .set('Authorization', `Bearer ${token}`);
    const updated = ws.body.data.controls[0].evidence;
    expect(updated.status).toBe('seen');
    expect(updated.fileName).toBe('evidence.pdf');
  });
});

// ── T3.01: Auto-create trigger ─────────────────────────────────────────────────

describe('Auto-create p1_evidence on assessment start', () => {
  // Scenario 14 — rows created on start
  test('SC14: starting assessment creates one p1_evidence row per control', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    const before = await P1Evidence.count({ where: { engagementId: engagement.id } });
    expect(before).toBe(0);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const after = await P1Evidence.count({ where: { engagementId: engagement.id } });
    expect(after).toBeGreaterThan(0);

    // All rows should start as not_provided
    const rows = await P1Evidence.findAll({ where: { engagementId: engagement.id } });
    expect(rows.every((r) => r.status === 'not_provided')).toBe(true);
  });

  // Scenario 15 — idempotent (re-start after cancel)
  test('SC15: re-starting (after cancel) does not duplicate evidence rows', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    const startRes = await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const assessmentId = startRes.body.data.id;
    const countAfterFirst = await P1Evidence.count({ where: { engagementId: engagement.id } });

    // Cancel
    await request(app)
      .post(`/api/v1/assessments/${assessmentId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    // Re-start
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const countAfterSecond = await P1Evidence.count({ where: { engagementId: engagement.id } });
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

// ── T3.05: No-RAG enforcement verification ─────────────────────────────────────

describe('T3.05 — No RAG Enforcement (GATE)', () => {
  const RAG_FIELDS = ['rag', 'ragLevel', 'severity', 'severityScore', 'consequence', 'findings', 'riskRating'];

  // Scenario 17 — API response contains NO RAG fields
  test('SC17: GET /phase1 response contains no RAG fields', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    const body = JSON.stringify(res.body);
    RAG_FIELDS.forEach((field) => {
      expect(body).not.toMatch(new RegExp(`"${field}"\\s*:`));
    });
  });

  // Scenario 18 — PUT evidence accepts no severity field
  test('SC18: PUT evidence rejects unknown fields (no severity accepted)', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const workspace = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    const item = workspace.body.data.controls[0].evidence;

    const res = await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'seen', severity: 3 }); // severity stripped by validation

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('severity');
    expect(res.body.data).not.toHaveProperty('rag');
  });

  // Scenario 19 — p1_evidence table schema has no RAG columns
  test('SC19: p1_evidence table schema has no RAG/severity/consequence/findings columns', async () => {
    const [columns] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'p1_evidence'`,
    );
    const colNames = columns.map((c) => c.column_name.toLowerCase());
    const forbidden = ['rag', 'rag_level', 'severity', 'severity_score', 'consequence', 'findings', 'risk_rating'];
    forbidden.forEach((col) => {
      expect(colNames).not.toContain(col);
    });
  });

  // Scenario 20 — validation rejects every RAG-level status value
  test('SC20: PUT evidence rejects all RAG-level status values via validation', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const ws = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    const item = ws.body.data.controls[0].evidence;

    for (const ragStatus of ['red', 'amber', 'green', 'amber_red', 'green_amber', 'rag_red']) {
      const res = await request(app)
        .put(`/api/v1/phase1-evidence/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: ragStatus });
      expect(res.status).toBe(422);
    }

    // Valid delivery statuses must still be accepted
    for (const goodStatus of ['not_provided', 'seen', 'partial', 'requested']) {
      const res = await request(app)
        .put(`/api/v1/phase1-evidence/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: goodStatus });
      expect(res.status).toBe(200);
    }
  });
});

// ── Progress calculation ───────────────────────────────────────────────────────

describe('Progress calculation', () => {
  async function getProgress(engagementId, token) {
    const res = await request(app)
      .get(`/api/v1/phase1/${engagementId}`)
      .set('Authorization', `Bearer ${token}`);
    return res.body.data.progress;
  }

  // Scenario 21 — initially 0%
  test('SC21: progress is 0% immediately after start', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const progress = await getProgress(engagement.id, token);
    expect(progress.percentageComplete).toBe(0);
    expect(progress.notProvided).toBe(progress.total);
  });

  // Scenario 22 — partial and seen count; requested and not_provided do not
  test('SC22: seen + partial count as complete; requested does not', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const ws = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    const items = ws.body.data.controls.slice(0, 3).map((c) => c.evidence);

    await request(app).put(`/api/v1/phase1-evidence/${items[0].id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'seen' });
    await request(app).put(`/api/v1/phase1-evidence/${items[1].id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'partial' });
    await request(app).put(`/api/v1/phase1-evidence/${items[2].id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'requested' });

    const progress = await getProgress(engagement.id, token);
    expect(progress.seen).toBeGreaterThanOrEqual(1);
    expect(progress.partial).toBeGreaterThanOrEqual(1);
    expect(progress.requested).toBeGreaterThanOrEqual(1);
    // seen + partial = done; requested is not done
    const done = progress.seen + progress.partial;
    expect(progress.percentageComplete).toBe(Math.round((done / progress.total) * 100));
  });

  // Scenario 16 — all controls seen → 100%
  test('SC16: all controls marked seen → progress is 100%', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);
    const token = await loginAs(admin);

    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);

    const ws = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    const items = ws.body.data.controls.map((c) => c.evidence);

    await Promise.all(
      items.map((ev) =>
        request(app)
          .put(`/api/v1/phase1-evidence/${ev.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'seen' }),
      ),
    );

    const progress = await getProgress(engagement.id, token);
    expect(progress.percentageComplete).toBe(100);
    expect(progress.notProvided).toBe(0);
    expect(progress.seen).toBe(progress.total);
  });
});

// ── Permission checks ─────────────────────────────────────────────────────────

describe('Permission checks', () => {
  // Scenario 23 — viewer can read but not update
  test('SC23: viewer can GET workspace but cannot PUT evidence', async () => {
    const viewer = await createUser({ roleName: 'VIEWER' });
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const engagement = await startedEngagement(op.id);

    const adminToken = await loginAs(admin);
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${adminToken}`);

    const ws = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const item = ws.body.data.controls[0].evidence;

    const viewerToken = await loginAs(viewer);
    const readRes = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(readRes.status).toBe(200);

    const writeRes = await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'seen' });
    expect(writeRes.status).toBe(403);
  });

  // Scenario 24 — operator can update evidence
  test('SC24: operator can GET workspace and PUT evidence', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const admin = await createUser({ roleName: 'ADMIN' });
    const engagement = await startedEngagement(op.id);

    const adminToken = await loginAs(admin);
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${adminToken}`);

    const ws = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const item = ws.body.data.controls[0].evidence;

    const opToken = await loginAs(op);
    const readRes = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${opToken}`);
    expect(readRes.status).toBe(200);

    const writeRes = await request(app)
      .put(`/api/v1/phase1-evidence/${item.id}`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ status: 'seen' });
    expect(writeRes.status).toBe(200);
  });
});

// ── T3.06: Performance tests ──────────────────────────────────────────────────

describe('T3.06 — Performance', () => {
  async function prepareStartedWorkspace() {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id, {
      engagementLetterSignedAt: '2026-01-10',
      invoiceRaisedAt: '2026-01-15',
      product: 'THE_CHECK',
    });
    const token = await loginAs(admin);
    await request(app)
      .post(`/api/v1/engagements/${engagement.id}/assessment/start`)
      .set('Authorization', `Bearer ${token}`);
    const ws = await request(app)
      .get(`/api/v1/phase1/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    const item = ws.body.data.controls[0].evidence;
    return { token, engagementId: engagement.id, itemId: item.id };
  }

  // PERF-01 — workspace load under 1 000 ms
  test('PERF-01: GET /phase1 workspace loads in under 1 000 ms', async () => {
    const { token, engagementId } = await prepareStartedWorkspace();

    const start = Date.now();
    const res = await request(app)
      .get(`/api/v1/phase1/${engagementId}`)
      .set('Authorization', `Bearer ${token}`);
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });

  // PERF-02 — evidence save under 200 ms
  test('PERF-02: PUT /phase1-evidence auto-save completes in under 200 ms', async () => {
    const { token, itemId } = await prepareStartedWorkspace();

    const start = Date.now();
    const res = await request(app)
      .put(`/api/v1/phase1-evidence/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Timing test note.', status: 'seen' });
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(200);
  });

  // PERF-03 — file upload under 3 000 ms (1 MB PDF)
  test('PERF-03: POST /upload for 1 MB file completes in under 3 000 ms', async () => {
    const { token, itemId } = await prepareStartedWorkspace();
    const oneMB = Buffer.alloc(1024 * 1024, 0x25); // 1 MB of '%'

    const start = Date.now();
    const res = await request(app)
      .post(`/api/v1/phase1-evidence/${itemId}/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', oneMB, { filename: 'perf-test.pdf', contentType: 'application/pdf' });
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(3000);
  }, 10000);
});
