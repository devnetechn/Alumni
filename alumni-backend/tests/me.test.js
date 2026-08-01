const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/me returns the authenticated user profile', async () => {
  const user = await insertUser({ full_name: 'Ada Lovelace' });
  const res = await request(app).get('/api/me').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
  expect(res.body.me.full_name).toBe('Ada Lovelace');
  expect(res.body.me.password_hash).toBeUndefined();
});

test('PUT /api/me updates editable profile fields', async () => {
  const user = await insertUser();
  const res = await request(app)
    .put('/api/me')
    .set('Authorization', authHeader(user))
    .send({ full_name: 'Updated Name', bio: 'Hello world', mentor_available: true });
  expect(res.status).toBe(200);
  expect(res.body.me.full_name).toBe('Updated Name');
  expect(res.body.me.bio).toBe('Hello world');
  expect(res.body.me.mentor_available).toBe(true);
});

test('PUT /api/me cannot escalate role via request body', async () => {
  const user = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .put('/api/me')
    .set('Authorization', authHeader(user))
    .send({ role: 'admin', full_name: 'Still Alumni' });
  expect(res.status).toBe(200);
  expect(res.body.me.role).toBe('alumni');
});
