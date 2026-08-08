const express = require('express');
const request = require('supertest');
const { pool, platformPool, query } = require('../src/db');
const { signToken, signPlatformToken } = require('../src/lib/token');
const { requirePlatformAdmin } = require('../src/middleware/platformAuth');
const { resetDb, insertUser } = require('./helpers');

afterAll(() => Promise.all([pool.end(), platformPool.end()]));

const app = express();
app.get('/protected', requirePlatformAdmin, (req, res) => res.json({ ok: true, admin: req.platformAdmin }));

async function insertPlatformAdmin(overrides = {}) {
  const rows = await query(
    `INSERT INTO platform_admins (email, password_hash) VALUES ($1, 'x') RETURNING id, email`,
    [overrides.email || `admin${Date.now()}@platform.test`]
  );
  return rows[0];
}

describe('requirePlatformAdmin', () => {
  beforeEach(resetDb);

  test('rejects a missing token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  test('rejects an invalid token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  test('rejects a well-formed school-user token (no type claim)', async () => {
    const user = await insertUser();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${signToken(user)}`);
    expect(res.status).toBe(401);
  });

  test('rejects a platform-admin token whose id no longer exists', async () => {
    const admin = await insertPlatformAdmin();
    const token = signPlatformToken(admin);
    await query('DELETE FROM platform_admins WHERE id = $1', [admin.id]);
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('accepts a valid platform-admin token', async () => {
    const admin = await insertPlatformAdmin();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${signPlatformToken(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe(admin.email);
  });
});
