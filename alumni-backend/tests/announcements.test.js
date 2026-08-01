const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/announcements is public', async () => {
  const res = await request(app).get('/api/announcements');
  expect(res.status).toBe(200);
  expect(res.body.announcements).toEqual([]);
});

test('POST /api/announcements requires admin', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(alumni))
    .send({ title: 'Hi', body: 'Not allowed' });
  expect(res.status).toBe(403);
});

test('admin can create and delete an announcement', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Welcome', body: 'Hello alumni!' });
  expect(create.status).toBe(201);
  expect(create.body.announcement.title).toBe('Welcome');

  const list = await request(app).get('/api/announcements');
  expect(list.body.announcements[0].poster_role).toBe('admin');

  const del = await request(app)
    .delete(`/api/announcements/${create.body.announcement.id}`)
    .set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
});
