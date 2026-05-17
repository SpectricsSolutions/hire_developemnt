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

const BASE_PAYLOAD = {
  product: 'HIRE_3D_CORE',
  engagementDate: '2026-02-01',
  feeCharged: 2000,
  feeStatus: 'INVOICED',
  auditStatus: 'SCHEDULED',
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/clients/:clientId/engagements
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/clients/:clientId/engagements', () => {
  test('admin creates an engagement — 201', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const res = await request(app)
      .post(`/api/v1/clients/${client.id}/engagements`)
      .set('Authorization', `Bearer ${token}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.data.product).toBe('HIRE_3D_CORE');
    expect(res.body.data.clientId).toBe(client.id);
  });

  test('viewer cannot create an engagement — 403', async () => {
    const viewer = await createUser({ roleName: 'VIEWER' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(viewer);
    const res = await request(app)
      .post(`/api/v1/clients/${client.id}/engagements`)
      .set('Authorization', `Bearer ${token}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  test('invalid engagement date format — 422', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const res = await request(app)
      .post(`/api/v1/clients/${client.id}/engagements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...BASE_PAYLOAD, engagementDate: '01-02-2026' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty('engagementDate');
  });

  test('audit date before engagement date — 422', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const res = await request(app)
      .post(`/api/v1/clients/${client.id}/engagements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...BASE_PAYLOAD, auditDate: '2026-01-01' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/clients/:clientId/engagements
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/clients/:clientId/engagements', () => {
  test('returns engagements for a client', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    await createEngagement(client.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test('returns empty list when client has no engagements', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/clients/:clientId/engagements/:engagementId
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/clients/:clientId/engagements/:engagementId', () => {
  test('returns the engagement', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(engagement.id);
  });

  test('unknown engagement — 404', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('engagement belonging to a different client — 404', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const clientA = await createClient({ assignedOperatorId: op.id, companyName: 'A' });
    const clientB = await createClient({ assignedOperatorId: op.id, companyName: 'B', primaryContactEmail: 'b@ex.com' });
    const engagement = await createEngagement(clientA.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/clients/${clientB.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fee redaction — operators and viewers do not see fee fields
// ──────────────────────────────────────────────────────────────────────────────

describe('fee field redaction', () => {
  test('admin sees fee fields', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveProperty('feeCharged');
    expect(res.body.data).toHaveProperty('feeStatus');
  });

  test('operator response omits fee fields on GET', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(op);

    const getRes = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body.data).not.toHaveProperty('feeCharged');
    expect(getRes.body.data).not.toHaveProperty('feeStatus');

    const listRes = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements`)
      .set('Authorization', `Bearer ${token}`);
    for (const item of listRes.body.data) {
      expect(item).not.toHaveProperty('feeCharged');
      expect(item).not.toHaveProperty('feeStatus');
    }
  });

  test('operator response omits fee fields on PUT', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(op);
    const res = await request(app)
      .put(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('feeCharged');
    expect(res.body.data).not.toHaveProperty('feeStatus');
  });

  test('viewer response omits fee fields', async () => {
    const viewer = await createUser({ roleName: 'VIEWER' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(viewer);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).not.toHaveProperty('feeCharged');
    expect(res.body.data).not.toHaveProperty('feeStatus');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/clients/:clientId/engagements/:engagementId
// ──────────────────────────────────────────────────────────────────────────────

describe('PUT /api/v1/clients/:clientId/engagements/:engagementId', () => {
  test('admin updates an engagement', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .put(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...BASE_PAYLOAD, feeStatus: 'PAID' });

    expect(res.status).toBe(200);
    expect(res.body.data.feeStatus).toBe('PAID');
  });

  test('viewer cannot update — 403', async () => {
    const viewer = await createUser({ roleName: 'VIEWER' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(viewer);
    const res = await request(app)
      .put(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/clients/:clientId/engagements/:engagementId
// ──────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/clients/:clientId/engagements/:engagementId', () => {
  test('admin deletes an engagement', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(admin);
    const delRes = await request(app)
      .delete(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  test('operator cannot delete — 403', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    const engagement = await createEngagement(client.id);

    const token = await loginAs(op);
    const res = await request(app)
      .delete(`/api/v1/clients/${client.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('engagement on wrong client — 404', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const clientA = await createClient({ assignedOperatorId: op.id, companyName: 'A2' });
    const clientB = await createClient({ assignedOperatorId: op.id, companyName: 'B2', primaryContactEmail: 'b2@ex.com' });
    const engagement = await createEngagement(clientA.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .delete(`/api/v1/clients/${clientB.id}/engagements/${engagement.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
