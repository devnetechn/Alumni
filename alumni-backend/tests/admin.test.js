const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

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
