const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('GET /api/admin/users requires admin', async () => {
  const alumni = await insertUser();
  const res = await request(app).get('/api/admin/users').set('Authorization', authHeader(alumni));
  expect(res.status).toBe(403);
});

test('admin can list users, toggle role/active/is_batch_leader, and delete others', async () => {
  const admin = await insertUser({ role: 'admin' });
  const target = await insertUser({ role: 'alumni', active: true, is_batch_leader: false });

  const list = await request(app).get('/api/admin/users').set('Authorization', authHeader(admin));
  expect(list.status).toBe(200);
  expect(list.body.users.some((u) => u.id === target.id)).toBe(true);
  expect(list.body.users[0].password_hash).toBeUndefined();

  const promote = await request(app)
    .put(`/api/admin/users/${target.id}`)
    .set('Authorization', authHeader(admin))
    .send({ role: 'admin', is_batch_leader: true });
  expect(promote.status).toBe(200);
  expect(promote.body.user.role).toBe('admin');
  expect(promote.body.user.is_batch_leader).toBe(true);

  const deactivate = await request(app)
    .put(`/api/admin/users/${target.id}`)
    .set('Authorization', authHeader(admin))
    .send({ active: false });
  expect(deactivate.body.user.active).toBe(false);

  const del = await request(app).delete(`/api/admin/users/${target.id}`).set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
});

test('admin cannot delete their own account', async () => {
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app).delete(`/api/admin/users/${admin.id}`).set('Authorization', authHeader(admin));
  expect(res.status).toBe(400);
});

test('deleting a user who owns an event/job/announcement succeeds and nulls out the ownership columns', async () => {
  const admin = await insertUser({ role: 'admin' });
  const owner = await insertUser({ role: 'admin' });

  const event = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(owner))
    .send({ title: 'Owned Event', event_date: '2026-12-01T18:00:00Z' });
  expect(event.status).toBe(201);

  const job = await request(app)
    .post('/api/jobs')
    .set('Authorization', authHeader(owner))
    .send({ title: 'Owned Job' });
  expect(job.status).toBe(201);

  const announcement = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(owner))
    .send({ title: 'Owned Announcement' });
  expect(announcement.status).toBe(201);

  const del = await request(app)
    .delete(`/api/admin/users/${owner.id}`)
    .set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);

  const eventRows = await query('SELECT created_by FROM events WHERE id = $1', [event.body.event.id]);
  expect(eventRows[0].created_by).toBeNull();

  const jobRows = await query('SELECT posted_by FROM jobs WHERE id = $1', [job.body.job.id]);
  expect(jobRows[0].posted_by).toBeNull();

  const announcementRows = await query('SELECT posted_by FROM announcements WHERE id = $1', [announcement.body.announcement.id]);
  expect(announcementRows[0].posted_by).toBeNull();
});
