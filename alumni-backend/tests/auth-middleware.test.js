const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('a request from a user with an expired registration is blocked with 402', async () => {
  const expiredUser = await insertUser({ registration_paid_until: new Date(Date.now() - 1000).toISOString() });
  const res = await request(app).get('/api/groups').set('Authorization', authHeader(expiredUser));
  expect(res.status).toBe(402);
  expect(res.body.error).toBe('Registration expired');
});

test('GET /api/me still works for an expired user (allowlisted)', async () => {
  const expiredUser = await insertUser({ registration_paid_until: new Date(Date.now() - 1000).toISOString() });
  const res = await request(app).get('/api/me').set('Authorization', authHeader(expiredUser));
  expect(res.status).toBe(200);
});

test('POST /api/registration/renew-checkout still works for an expired user (allowlisted)', async () => {
  const expiredUser = await insertUser({ registration_paid_until: new Date(Date.now() - 1000).toISOString() });
  const res = await request(app).post('/api/registration/renew-checkout').set('Authorization', authHeader(expiredUser));
  // Not 402 — it may still fail with 400 (no fee configured) but must not be blocked by the expiry gate.
  expect(res.status).not.toBe(402);
});

test('a request from a user with a future registration_paid_until succeeds normally', async () => {
  const user = await insertUser({ registration_paid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
  const res = await request(app).get('/api/groups').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
});
