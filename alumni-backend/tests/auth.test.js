const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('POST /api/auth/register creates an alumni user and returns a token', async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: 'new@test.com',
    password: 'secret123',
    full_name: 'New Person',
    batch_year: 2021,
    course: 'BSIT',
  });
  expect(res.status).toBe(201);
  expect(res.body.token).toBeTruthy();
  expect(res.body.user.email).toBe('new@test.com');
  expect(res.body.user.role).toBe('alumni');
  expect(res.body.user.password_hash).toBeUndefined();
});

test('POST /api/auth/register rejects a duplicate email', async () => {
  await insertUser({ email: 'dupe@test.com' });
  const res = await request(app).post('/api/auth/register').send({
    email: 'dupe@test.com',
    password: 'secret123',
    full_name: 'Dupe',
  });
  expect(res.status).toBe(409);
});

test('POST /api/auth/login succeeds with correct credentials', async () => {
  await request(app).post('/api/auth/register').send({
    email: 'login@test.com',
    password: 'secret123',
    full_name: 'Login Person',
  });
  const res = await request(app).post('/api/auth/login').send({
    email: 'login@test.com',
    password: 'secret123',
  });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
});

test('POST /api/auth/login rejects wrong password', async () => {
  await request(app).post('/api/auth/register').send({
    email: 'login2@test.com',
    password: 'secret123',
    full_name: 'Login Person 2',
  });
  const res = await request(app).post('/api/auth/login').send({
    email: 'login2@test.com',
    password: 'wrongpassword',
  });
  expect(res.status).toBe(401);
});

test('POST /api/auth/login rejects a deactivated user even with correct credentials', async () => {
  await insertUser({ email: 'deactivated@test.com', active: false });
  const res = await request(app).post('/api/auth/login').send({
    email: 'deactivated@test.com',
    password: 'password123',
  });
  expect(res.status).toBe(403);
});
