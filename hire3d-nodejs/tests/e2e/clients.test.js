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

function clientPayload(assignedOperatorId) {
  return {
    companyName: 'Acme Ltd',
    primaryContactName: 'Jane Doe',
    primaryContactEmail: 'jane@acme.example.com',
    headcountAtEngagement: 25,
    businessStage: 'GROWTH',
    region: 'LONDON',
    assignedOperatorId,
    status: 'ACTIVE',
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/v1/clients
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/clients', () => {
  test('admin creates a client — 201', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const token = await loginAs(admin);

    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(clientPayload(op.id));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyName).toBe('Acme Ltd');
  });

  test('operator cannot create a client — 403', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const token = await loginAs(op);

    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(clientPayload(op.id));

    expect(res.status).toBe(403);
  });

  test('unauthenticated request — 401', async () => {
    const res = await request(app).post('/api/v1/clients').send({});
    expect(res.status).toBe(401);
  });

  test('invalid email — 422 with field-level error', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const token = await loginAs(admin);

    const payload = { ...clientPayload(op.id), primaryContactEmail: 'not-an-email' };
    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation error.');
    expect(res.body.errors).toHaveProperty('primaryContactEmail');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/clients
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/clients', () => {
  test('admin sees all clients', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    await createClient({ assignedOperatorId: op.id, companyName: 'A' });
    await createClient({ assignedOperatorId: op.id, companyName: 'B', primaryContactEmail: 'b@b.example.com' });

    const token = await loginAs(admin);
    const res = await request(app)
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  test('operator sees only assigned clients', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const other = await createUser({ roleName: 'OPERATOR' });
    const mine = await createClient({ assignedOperatorId: op.id, companyName: 'Mine' });
    await createClient({ assignedOperatorId: other.id, companyName: 'Theirs', primaryContactEmail: 'theirs@ex.com' });

    const token = await loginAs(op);
    const res = await request(app)
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.id)).toEqual([mine.id]);
  });

  test('viewer sees all clients (has clients:read_all)', async () => {
    const viewer = await createUser({ roleName: 'VIEWER' });
    const op = await createUser({ roleName: 'OPERATOR' });
    await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(viewer);
    const res = await request(app)
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('unauthenticated — 401', async () => {
    const res = await request(app).get('/api/v1/clients');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/v1/clients/:clientId
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/clients/:clientId', () => {
  test('admin reads any client', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(client.id);
  });

  test('operator reads their assigned client', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(op);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('operator cannot read an unassigned client — 403', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const other = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: other.id });

    const token = await loginAs(op);
    const res = await request(app)
      .get(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('unknown client — 404', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const token = await loginAs(admin);

    const res = await request(app)
      .get('/api/v1/clients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/clients/:clientId
// ──────────────────────────────────────────────────────────────────────────────

describe('PUT /api/v1/clients/:clientId', () => {
  test('admin can update a client', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const res = await request(app)
      .put(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...clientPayload(op.id), companyName: 'Renamed Co' });

    expect(res.status).toBe(200);
    expect(res.body.data.companyName).toBe('Renamed Co');
  });

  test('viewer cannot update a client — 403', async () => {
    const viewer = await createUser({ roleName: 'VIEWER' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(viewer);
    const res = await request(app)
      .put(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(clientPayload(op.id));

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/clients/:clientId
// ──────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/clients/:clientId', () => {
  test('admin can delete a client', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(admin);
    const delRes = await request(app)
      .delete(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  test('operator cannot delete a client — 403', async () => {
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });

    const token = await loginAs(op);
    const res = await request(app)
      .delete(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('unknown client — 404', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const token = await loginAs(admin);

    const res = await request(app)
      .delete('/api/v1/clients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('client with engagements returns 409', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const op = await createUser({ roleName: 'OPERATOR' });
    const client = await createClient({ assignedOperatorId: op.id });
    await createEngagement(client.id);

    const token = await loginAs(admin);
    const res = await request(app)
      .delete(`/api/v1/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});
