const express = require('express');
const request = require('supertest');
const { pool } = require('../src/db');
const { requireAuth, requireAdmin } = require('../src/middleware/auth');
const { resetDb, insertUser, authHeader } = require('./helpers');

const app = express();
app.get('/protected', requireAuth, (req, res) => res.json({ id: req.user.id }));
app.get('/admin-only', requireAuth, requireAdmin, (req, res) => res.json({ ok: true }));

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('rejects requests with no token', async () => {
  const res = await request(app).get('/protected');
  expect(res.status).toBe(401);
});

test('accepts a valid token and attaches req.user', async () => {
  const user = await insertUser();
  const res = await request(app).get('/protected').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(user.id);
});

test('requireAdmin rejects non-admin users', async () => {
  const user = await insertUser({ role: 'alumni' });
  const res = await request(app).get('/admin-only').set('Authorization', authHeader(user));
  expect(res.status).toBe(403);
});

test('requireAdmin accepts admin users', async () => {
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app).get('/admin-only').set('Authorization', authHeader(admin));
  expect(res.status).toBe(200);
});

test('rejects a valid token for a deactivated user', async () => {
  const user = await insertUser({ active: false });
  const res = await request(app).get('/protected').set('Authorization', authHeader(user));
  expect(res.status).toBe(403);
});
