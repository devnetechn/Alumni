const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('GET /api/announcements is public', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/announcements').set('Host', hostFor(school));
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

  const school = await getDefaultSchool();
  const list = await request(app).get('/api/announcements').set('Host', hostFor(school));
  expect(list.body.announcements[0].poster_role).toBe('admin');

  const del = await request(app)
    .delete(`/api/announcements/${create.body.announcement.id}`)
    .set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
});

test('POST /api/announcements notifies all other active users but not the poster', async () => {
  const admin = await insertUser({ role: 'admin' });
  const other = await insertUser();

  await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Big News', body: 'Details here' });

  const otherRows = await query('SELECT * FROM notifications WHERE user_id = $1', [other.id]);
  expect(otherRows.length).toBe(1);
  expect(otherRows[0].type).toBe('announcement');

  const adminRows = await query('SELECT * FROM notifications WHERE user_id = $1', [admin.id]);
  expect(adminRows.length).toBe(0);
});

test('announcement agenda is saved and returned', async () => {
  const admin = await insertUser({ role: 'admin' });
  const agenda = [{ time: '9:00 AM', activity: 'Registration' }, { time: '10:00 AM', activity: 'Program' }];
  const create = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Reunion', body: 'Join us', agenda });
  expect(create.status).toBe(201);
  expect(create.body.announcement.agenda).toEqual(agenda);
});

test('announcement agenda defaults to an empty list', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(admin))
    .send({ title: 'No agenda' });
  expect(create.status).toBe(201);
  expect(create.body.announcement.agenda).toEqual([]);
});

test('malformed agenda is rejected with 400', async () => {
  const admin = await insertUser({ role: 'admin' });
  for (const agenda of ['x', [{ time: '9 AM' }], [{ activity: 5 }], [null]]) {
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', authHeader(admin))
      .send({ title: 'Bad', agenda });
    expect(res.status).toBe(400);
  }
});

test('GET /api/announcements/:id is public and 404s on unknown or non-numeric ids', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Detail', body: 'Body', agenda: [{ time: '1 PM', activity: 'Lunch' }] });
  const school = await getDefaultSchool();

  const ok = await request(app).get(`/api/announcements/${create.body.announcement.id}`).set('Host', hostFor(school));
  expect(ok.status).toBe(200);
  expect(ok.body.announcement.title).toBe('Detail');
  expect(ok.body.announcement.poster_role).toBe('admin');
  expect(ok.body.announcement.agenda).toEqual([{ time: '1 PM', activity: 'Lunch' }]);

  expect((await request(app).get('/api/announcements/999999').set('Host', hostFor(school))).status).toBe(404);
  expect((await request(app).get('/api/announcements/abc').set('Host', hostFor(school))).status).toBe(404);
});
