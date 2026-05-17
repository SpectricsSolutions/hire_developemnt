'use strict';

const request = require('supertest');
const { generate: totpGenerate } = require('otplib');
const app = require('../../src/app');
const { cleanTables } = require('../helpers/db');
const { createUser, DEFAULT_PASSWORD } = require('../helpers/factories');

afterEach(cleanTables);

// Helper: log in and return access token + Set-Cookie header.
async function login(email, password = DEFAULT_PASSWORD) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    status: res.status,
    body: res.body,
    accessToken: res.body.data?.accessToken,
    cookie: res.headers['set-cookie'],
  };
}

// Helper: parse the TOTP secret from an otpauth:// URI.
function parseSecret(qrUri) {
  const match = qrUri.match(/[?&]secret=([^&]+)/i);
  return match ? match[1] : null;
}

// Helper: generate a current TOTP code for a given secret.
async function totpCode(secret) {
  return totpGenerate({ secret, type: 'totp' });
}

// ──────────────────────────────────────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  test('returns access token and sets refresh cookie on success', async () => {
    const user = await createUser({ email: 'login@example.com' });
    const { status, body, accessToken, cookie } = await login(user.email);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(accessToken).toBeTruthy();
    expect(body.data.tokenType).toBe('bearer');
    expect(cookie).toBeDefined();
    expect(cookie.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  test('returns 401 for wrong password', async () => {
    const user = await createUser({ email: 'badpw@example.com' });
    const { status } = await login(user.email, 'WrongPassword!');
    expect(status).toBe(401);
  });

  test('returns 401 for unknown email', async () => {
    const { status } = await login('nobody@example.com');
    expect(status).toBe(401);
  });

  test('returns 401 for INACTIVE user', async () => {
    const user = await createUser({ email: 'inactive@example.com', status: 'INACTIVE' });
    const { status } = await login(user.email);
    expect(status).toBe(401);
  });

  test('returns 403 for PENDING user', async () => {
    const user = await createUser({ email: 'pending@example.com', status: 'PENDING' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/pending/i);
  });

  test('returns 422 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: DEFAULT_PASSWORD });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('returns 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(422);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Refresh
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  test('issues a new access token using the refresh cookie', async () => {
    const user = await createUser({ email: 'refresh@example.com' });
    const { cookie } = await login(user.email);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  test('returns 401 without cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  test('returns 401 for unknown token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=00000000-0000-0000-0000-000000000000; Path=/api/v1/auth');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  test('returns 200 and revokes the refresh token', async () => {
    const user = await createUser({ email: 'logout@example.com' });
    const { cookie } = await login(user.email);

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    // Token should be unusable after logout.
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });

  test('returns 200 with no cookie (silent noop)', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TOTP — setup / verify / confirm / disable
// ──────────────────────────────────────────────────────────────────────────────

describe('TOTP lifecycle', () => {
  let user, accessToken;

  beforeEach(async () => {
    user = await createUser({ email: 'totp@example.com' });
    ({ accessToken } = await login(user.email));
  });

  test('POST /api/v1/auth/totp/setup requires authentication', async () => {
    const res = await request(app).post('/api/v1/auth/totp/setup');
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/totp/setup returns QR URI and issuer', async () => {
    const res = await request(app)
      .post('/api/v1/auth/totp/setup')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.qrUri).toMatch(/^otpauth:\/\/totp\//);
    expect(res.body.data.issuer).toBe('Hire3D');
  });

  test('POST /api/v1/auth/totp/setup is idempotent', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    await request(app).post('/api/v1/auth/totp/setup').set(headers);
    const res2 = await request(app).post('/api/v1/auth/totp/setup').set(headers);
    expect(res2.status).toBe(200);
  });

  test('POST /api/v1/auth/totp/verify enables TOTP with a valid code', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };

    const setup = await request(app).post('/api/v1/auth/totp/setup').set(headers);
    const secret = parseSecret(setup.body.data.qrUri);
    const code = await totpCode(secret);

    const res = await request(app)
      .post('/api/v1/auth/totp/verify')
      .set(headers)
      .send({ code });

    expect(res.status).toBe(200);
  });

  test('POST /api/v1/auth/totp/verify rejects wrong code', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    await request(app).post('/api/v1/auth/totp/setup').set(headers);

    const res = await request(app)
      .post('/api/v1/auth/totp/verify')
      .set(headers)
      .send({ code: '000000' });

    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/totp/verify rejects when not enrolled', async () => {
    const res = await request(app)
      .post('/api/v1/auth/totp/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '123456' });
    expect(res.status).toBe(401);
  });

  test('login returns TOTP challenge when TOTP is enabled', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const setup = await request(app).post('/api/v1/auth/totp/setup').set(headers);
    const secret = parseSecret(setup.body.data.qrUri);
    await request(app)
      .post('/api/v1/auth/totp/verify')
      .set(headers)
      .send({ code: await totpCode(secret) });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.requires2fa).toBe(true);
    expect(loginRes.body.data.totpToken).toBeTruthy();
  });

  test('POST /api/v1/auth/totp/confirm issues tokens with a valid code', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const setup = await request(app).post('/api/v1/auth/totp/setup').set(headers);
    const secret = parseSecret(setup.body.data.qrUri);
    await request(app)
      .post('/api/v1/auth/totp/verify')
      .set(headers)
      .send({ code: await totpCode(secret) });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    const totpToken = loginRes.body.data.totpToken;

    const confirmRes = await request(app)
      .post('/api/v1/auth/totp/confirm')
      .send({ totpToken, code: await totpCode(secret) });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.accessToken).toBeTruthy();
    expect(confirmRes.headers['set-cookie'].some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  test('POST /api/v1/auth/totp/confirm rejects wrong TOTP code', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const setup = await request(app).post('/api/v1/auth/totp/setup').set(headers);
    const secret = parseSecret(setup.body.data.qrUri);
    await request(app)
      .post('/api/v1/auth/totp/verify')
      .set(headers)
      .send({ code: await totpCode(secret) });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });

    const confirmRes = await request(app)
      .post('/api/v1/auth/totp/confirm')
      .send({ totpToken: loginRes.body.data.totpToken, code: '000000' });

    expect(confirmRes.status).toBe(401);
  });

  test('POST /api/v1/auth/totp/confirm rejects invalid TOTP token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/totp/confirm')
      .send({ totpToken: 'not.a.valid.jwt', code: '123456' });
    expect(res.status).toBe(401);
  });

  test('DELETE /api/v1/auth/totp disables TOTP after it was enrolled', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const setup = await request(app).post('/api/v1/auth/totp/setup').set(headers);
    const secret = parseSecret(setup.body.data.qrUri);
    await request(app)
      .post('/api/v1/auth/totp/verify')
      .set(headers)
      .send({ code: await totpCode(secret) });

    const disableRes = await request(app).delete('/api/v1/auth/totp').set(headers);
    expect(disableRes.status).toBe(200);

    // Subsequent login should no longer return a TOTP challenge.
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(loginRes.body.data.requires2fa).toBe(false);
  });

  test('DELETE /api/v1/auth/totp returns 404 when not enrolled', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/totp')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/v1/auth/totp requires authentication', async () => {
    const res = await request(app).delete('/api/v1/auth/totp');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Revoke sessions
// ──────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/auth/sessions/:userId', () => {
  test('admin can revoke another user\'s sessions', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const target = await createUser({ roleName: 'OPERATOR' });

    const { accessToken: adminToken } = await login(admin.email);
    const { cookie: targetCookie } = await login(target.email);

    const revokeRes = await request(app)
      .delete(`/api/v1/auth/sessions/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revokeRes.status).toBe(200);

    // Target's refresh cookie is now revoked.
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', targetCookie);
    expect(refreshRes.status).toBe(401);
  });

  test('non-admin cannot revoke another user\'s sessions', async () => {
    const operator = await createUser({ roleName: 'OPERATOR' });
    const target = await createUser({ roleName: 'OPERATOR' });

    const { accessToken: opToken } = await login(operator.email);

    const res = await request(app)
      .delete(`/api/v1/auth/sessions/${target.id}`)
      .set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });

  test('unauthenticated request returns 401', async () => {
    const target = await createUser({ email: 'target3@example.com' });
    const res = await request(app).delete(`/api/v1/auth/sessions/${target.id}`);
    expect(res.status).toBe(401);
  });

  test('returns 404 for unknown user id', async () => {
    const admin = await createUser({ roleName: 'ADMIN' });
    const { accessToken } = await login(admin.email);

    const res = await request(app)
      .delete('/api/v1/auth/sessions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});
