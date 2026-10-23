const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

const submit = async (body) => {
  const school = await getDefaultSchool();
  return request(app).post('/api/sponsor/inquiries').set('Host', hostFor(school)).send(body);
};

test('inquiry needs a name and a valid email', async () => {
  expect((await submit({ email: 'a@b.com' })).status).toBe(400);
  expect((await submit({ name: 'Acme' })).status).toBe(400);
  expect((await submit({ name: 'Acme', email: 'not-an-email' })).status).toBe(400);
});

test('overlong fields are rejected', async () => {
  expect((await submit({ name: 'Acme', email: 'a@b.com', message: 'x'.repeat(5001) })).status).toBe(400);
  expect((await submit({ name: 'n'.repeat(201), email: 'a@b.com' })).status).toBe(400);
});

test('anyone can submit a valid inquiry without logging in', async () => {
  const res = await submit({ name: 'Acme Corp', email: 'hello@acme.com', organization: 'Acme', message: 'We want to help' });
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ ok: true });
});

test('listing is admin-only and shows submissions; admin can delete', async () => {
  await submit({ name: 'Acme Corp', email: 'hello@acme.com', message: 'Hi' });
  const school = await getDefaultSchool();

  expect((await request(app).get('/api/sponsor/inquiries').set('Host', hostFor(school))).status).toBe(401);
  const alumni = await insertUser({ role: 'alumni' });
  expect((await request(app).get('/api/sponsor/inquiries').set('Authorization', authHeader(alumni))).status).toBe(403);

  const admin = await insertUser({ role: 'admin' });
  const list = await request(app).get('/api/sponsor/inquiries').set('Authorization', authHeader(admin));
  expect(list.status).toBe(200);
  expect(list.body.inquiries.length).toBe(1);
  expect(list.body.inquiries[0].email).toBe('hello@acme.com');

  const id = list.body.inquiries[0].id;
  expect((await request(app).delete(`/api/sponsor/inquiries/${id}`).set('Authorization', authHeader(admin))).status).toBe(204);
  expect((await request(app).delete(`/api/sponsor/inquiries/${id}`).set('Authorization', authHeader(admin))).status).toBe(404);
});
