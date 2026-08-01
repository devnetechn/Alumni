const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/alumni requires auth', async () => {
  const res = await request(app).get('/api/alumni');
  expect(res.status).toBe(401);
});

test('GET /api/alumni lists alumni and includes user_id', async () => {
  const me = await insertUser();
  await insertUser({ full_name: 'Jane Doe', course: 'BSIT', batch_year: 2019 });
  const res = await request(app).get('/api/alumni').set('Authorization', authHeader(me));
  expect(res.status).toBe(200);
  expect(res.body.alumni.length).toBeGreaterThanOrEqual(2);
  expect(res.body.alumni[0].user_id).toBe(res.body.alumni[0].id);
  expect(res.body.alumni[0].password_hash).toBeUndefined();
});

test('GET /api/alumni filters by search text across name/company/position', async () => {
  const me = await insertUser();
  await insertUser({ full_name: 'Zed Zebra', company: 'Acme Corp' });
  await insertUser({ full_name: 'Someone Else', company: 'Other Inc' });
  const res = await request(app)
    .get('/api/alumni')
    .query({ search: 'Zebra' })
    .set('Authorization', authHeader(me));
  expect(res.status).toBe(200);
  expect(res.body.alumni.some((a) => a.full_name === 'Zed Zebra')).toBe(true);
  expect(res.body.alumni.some((a) => a.full_name === 'Someone Else')).toBe(false);
});

test('GET /api/alumni filters by mentor=1', async () => {
  const me = await insertUser();
  await insertUser({ full_name: 'Mentor Person', mentor_available: true });
  await insertUser({ full_name: 'Non Mentor', mentor_available: false });
  const res = await request(app)
    .get('/api/alumni')
    .query({ mentor: '1' })
    .set('Authorization', authHeader(me));
  expect(res.body.alumni.every((a) => a.mentor_available === true)).toBe(true);
});
