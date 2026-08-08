const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query, queryForSchool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool } = require('./helpers');
const { createNotification } = require('../src/routes/notifications');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function testDb() {
  const school = await getDefaultSchool();
  return (text, params) => queryForSchool(school.id, text, params);
}

test('GET /api/notifications lists notifications and unread count', async () => {
  const user = await insertUser();
  const db = await testDb();
  await createNotification(db, { userId: user.id, type: 'info', title: 'Welcome', body: 'Hi there' });
  await createNotification(db, { userId: user.id, type: 'info', title: 'Second' });

  const res = await request(app).get('/api/notifications').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
  expect(res.body.notifications.length).toBe(2);
  expect(res.body.unread).toBe(2);
});

test('PATCH /api/notifications marks all as read', async () => {
  const user = await insertUser();
  const db = await testDb();
  await createNotification(db, { userId: user.id, type: 'info', title: 'One' });
  await createNotification(db, { userId: user.id, type: 'info', title: 'Two' });

  const patch = await request(app).patch('/api/notifications').set('Authorization', authHeader(user)).send({});
  expect(patch.status).toBe(204);

  const res = await request(app).get('/api/notifications').set('Authorization', authHeader(user));
  expect(res.body.unread).toBe(0);
});

test('createNotification inserts a row scoped to the given user', async () => {
  const user = await insertUser();
  const other = await insertUser();
  const db = await testDb();
  await createNotification(db, { userId: user.id, type: 'info', title: 'Only for user' });

  const rows = await query('SELECT * FROM notifications WHERE user_id = $1', [other.id]);
  expect(rows.length).toBe(0);
});
