const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('POST /api/auth/register creates an alumni user and returns a token', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
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

test('POST /api/auth/register defaults member_type to alumnus when omitted', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({ email: 'defaulttype@test.com', password: 'secret123', full_name: 'Default Type' });
  expect(res.status).toBe(201);
  expect(res.body.user.member_type).toBe('alumnus');
});

test('POST /api/auth/register accepts member_type guest and stores address', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'guest@test.com',
      password: 'secret123',
      full_name: 'A Guest',
      member_type: 'guest',
      address: '123 Main St',
    });
  expect(res.status).toBe(201);
  expect(res.body.user.member_type).toBe('guest');
  expect(res.body.user.address).toBe('123 Main St');
});

test('POST /api/auth/register rejects an invalid member_type', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({ email: 'badtype@test.com', password: 'secret123', member_type: 'faculty' });
  expect(res.status).toBe(400);
});

test('POST /api/auth/register rejects a duplicate email within the same school', async () => {
  const school = await getDefaultSchool();
  await insertUser({ email: 'dupe@test.com' });
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'dupe@test.com',
      password: 'secret123',
      full_name: 'Dupe',
    });
  expect(res.status).toBe(409);
});

test('POST /api/auth/login succeeds with correct credentials', async () => {
  const school = await getDefaultSchool();
  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'login@test.com',
      password: 'secret123',
      full_name: 'Login Person',
    });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(school))
    .send({
      email: 'login@test.com',
      password: 'secret123',
    });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
});

test('POST /api/auth/login rejects wrong password', async () => {
  const school = await getDefaultSchool();
  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'login2@test.com',
      password: 'secret123',
      full_name: 'Login Person 2',
    });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(school))
    .send({
      email: 'login2@test.com',
      password: 'wrongpassword',
    });
  expect(res.status).toBe(401);
});

test('POST /api/auth/login rejects a deactivated user even with correct credentials', async () => {
  const school = await getDefaultSchool();
  await insertUser({ email: 'deactivated@test.com', active: false });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(school))
    .send({
      email: 'deactivated@test.com',
      password: 'password123',
    });
  expect(res.status).toBe(403);
});
