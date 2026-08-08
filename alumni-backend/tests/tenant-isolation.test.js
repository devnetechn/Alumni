const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, createSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('a user from school A cannot see school B\'s alumni directory', async () => {
  const schoolA = await createSchool({ slug: 'school-a' });
  const schoolB = await createSchool({ slug: 'school-b' });
  const userA = await insertUser({ school_id: schoolA.id, full_name: 'Alice A' });
  await insertUser({ school_id: schoolB.id, full_name: 'Bob B' });

  const res = await request(app).get('/api/alumni').set('Authorization', authHeader(userA));
  expect(res.status).toBe(200);
  expect(res.body.alumni.some((a) => a.full_name === 'Alice A')).toBe(true);
  expect(res.body.alumni.some((a) => a.full_name === 'Bob B')).toBe(false);
});

test('a school-A token cannot fetch a school-A-shaped event that actually belongs to school B', async () => {
  const schoolA = await createSchool({ slug: 'school-a-events' });
  const schoolB = await createSchool({ slug: 'school-b-events' });
  const adminA = await insertUser({ school_id: schoolA.id, role: 'admin' });
  const adminB = await insertUser({ school_id: schoolB.id, role: 'admin' });

  const createB = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(adminB))
    .send({ title: 'School B Only Event', event_date: '2026-12-01T18:00:00Z' });
  const eventBId = createB.body.event.id;

  const res = await request(app)
    .get(`/api/events/${eventBId}`)
    .set('Authorization', authHeader(adminA));
  expect(res.status).toBe(404);
});

test('logging in with the same email on two different schools resolves two different accounts', async () => {
  const schoolA = await createSchool({ slug: 'dup-email-a' });
  const schoolB = await createSchool({ slug: 'dup-email-b' });

  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(schoolA))
    .send({ email: 'shared@test.com', password: 'passwordA', full_name: 'Person At A' });
  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(schoolB))
    .send({ email: 'shared@test.com', password: 'passwordB', full_name: 'Person At B' });

  const loginA = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(schoolA))
    .send({ email: 'shared@test.com', password: 'passwordA' });
  expect(loginA.status).toBe(200);
  expect(loginA.body.user.full_name).toBe('Person At A');

  const loginB = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(schoolB))
    .send({ email: 'shared@test.com', password: 'passwordB' });
  expect(loginB.status).toBe(200);
  expect(loginB.body.user.full_name).toBe('Person At B');

  const crossLogin = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(schoolA))
    .send({ email: 'shared@test.com', password: 'passwordB' });
  expect(crossLogin.status).toBe(401);
});

test('a message sent between two school-A users is invisible to a school-B admin querying directly', async () => {
  const schoolA = await createSchool({ slug: 'msg-school-a' });
  const schoolB = await createSchool({ slug: 'msg-school-b' });
  const userA1 = await insertUser({ school_id: schoolA.id });
  const userA2 = await insertUser({ school_id: schoolA.id });
  const adminB = await insertUser({ school_id: schoolB.id, role: 'admin' });

  await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(userA1))
    .send({ receiver_id: userA2.id, body: 'Secret to school A' });

  const res = await request(app).get('/api/messages').set('Authorization', authHeader(adminB));
  expect(res.status).toBe(200);
  expect(res.body.conversations.length).toBe(0);
});

test('a token minted for school A is rejected outright on school B\'s subdomain', async () => {
  const schoolA = await createSchool({ slug: 'token-school-a' });
  const schoolB = await createSchool({ slug: 'token-school-b' });
  const userA = await insertUser({ school_id: schoolA.id });

  const res = await request(app)
    .get('/api/alumni')
    .set('Authorization', authHeader(userA))
    .set('Host', hostFor(schoolB));
  expect(res.status).toBe(401);
});
