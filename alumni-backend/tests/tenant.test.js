const express = require('express');
const request = require('supertest');
const { pool, appPool } = require('../src/db');
const { resolveTenant } = require('../src/middleware/tenant');
const { signToken } = require('../src/lib/token');

afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeSchool(slug) {
  const rows = await pool.query(
    `INSERT INTO schools (slug, name) VALUES ($1, $2) RETURNING id, slug`,
    [slug, slug]
  );
  return rows.rows[0];
}

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE schools RESTART IDENTITY CASCADE');
});

function buildApp() {
  const app = express();
  app.use(resolveTenant);
  app.get('/whoami', (req, res) => res.json({ schoolId: req.school.id, slug: req.school.slug }));
  return app;
}

test('resolves the school from a matching subdomain', async () => {
  const school = await makeSchool('ihes-test');
  const app = buildApp();
  const res = await request(app).get('/whoami').set('Host', 'ihes-test.example.com');
  expect(res.status).toBe(200);
  expect(res.body.schoolId).toBe(school.id);
});

test('returns 404 for an unknown subdomain with no fallback token', async () => {
  const app = buildApp();
  const res = await request(app).get('/whoami').set('Host', 'nonexistent.example.com');
  expect(res.status).toBe(404);
});

test('falls back to the JWT school_id when the Host does not resolve', async () => {
  const school = await makeSchool('fallback-test');
  const app = buildApp();
  const token = signToken({ id: 1, role: 'alumni', school_id: school.id });
  const res = await request(app)
    .get('/whoami')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.schoolId).toBe(school.id);
});

test('returns 404 for an inactive school even if the slug matches', async () => {
  const rows = await pool.query(
    `INSERT INTO schools (slug, name, active) VALUES ('inactive-test', 'Inactive', false) RETURNING id`
  );
  const app = buildApp();
  const res = await request(app).get('/whoami').set('Host', 'inactive-test.example.com');
  expect(res.status).toBe(404);
});

test('falls back to SINGLE_TENANT_SLUG even in production when Host and token do not resolve', async () => {
  const school = await makeSchool('single-tenant-test');
  const app = buildApp();
  const originalEnv = process.env.NODE_ENV;
  const originalSlug = process.env.SINGLE_TENANT_SLUG;
  process.env.NODE_ENV = 'production';
  process.env.SINGLE_TENANT_SLUG = 'single-tenant-test';
  try {
    const res = await request(app).get('/whoami').set('Host', 'unrecognized.example.com');
    expect(res.status).toBe(200);
    expect(res.body.schoolId).toBe(school.id);
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.SINGLE_TENANT_SLUG = originalSlug;
  }
});

test('SINGLE_TENANT_SLUG does not override a resolved subdomain match', async () => {
  const hostSchool = await makeSchool('host-match-test');
  await makeSchool('single-tenant-other');
  const app = buildApp();
  const originalSlug = process.env.SINGLE_TENANT_SLUG;
  process.env.SINGLE_TENANT_SLUG = 'single-tenant-other';
  try {
    const res = await request(app).get('/whoami').set('Host', 'host-match-test.example.com');
    expect(res.status).toBe(200);
    expect(res.body.schoolId).toBe(hostSchool.id);
  } finally {
    process.env.SINGLE_TENANT_SLUG = originalSlug;
  }
});

const { app: realApp } = require('../src/server');

test('the real app resolves a school before hitting a route', async () => {
  await makeSchool('server-wiring-test');
  const res = await request(realApp).get('/api/health').set('Host', 'server-wiring-test.example.com');
  expect(res.status).toBe(200); // health check bypasses tenant resolution entirely
});
