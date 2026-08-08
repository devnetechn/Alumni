const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('POST /api/groups creates a group and auto-joins the creator', async () => {
  const user = await insertUser();
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', authHeader(user))
    .send({ name: 'Batch 2020', description: 'Our batch', kind: 'batch' });
  expect(res.status).toBe(201);

  const list = await request(app).get('/api/groups').set('Authorization', authHeader(user));
  const group = list.body.groups.find((g) => g.id === res.body.group.id);
  expect(group.member_count).toBe(1);
  expect(group.is_member).toBe(true);
});

test('join and leave a group', async () => {
  const creator = await insertUser();
  const joiner = await insertUser();
  const create = await request(app).post('/api/groups').set('Authorization', authHeader(creator)).send({ name: 'Mentors', kind: 'mentorship' });
  const groupId = create.body.group.id;

  const join = await request(app).post(`/api/groups/${groupId}/join`).set('Authorization', authHeader(joiner));
  expect(join.status).toBe(204);

  const detail = await request(app).get(`/api/groups/${groupId}`).set('Authorization', authHeader(joiner));
  expect(detail.body.isMember).toBe(true);
  expect(detail.body.members.length).toBe(2);

  const leave = await request(app).delete(`/api/groups/${groupId}/join`).set('Authorization', authHeader(joiner));
  expect(leave.status).toBe(204);

  const detail2 = await request(app).get(`/api/groups/${groupId}`).set('Authorization', authHeader(joiner));
  expect(detail2.body.isMember).toBe(false);
});

test('only members can post; posts include author name', async () => {
  const creator = await insertUser({ full_name: 'Creator Name' });
  const outsider = await insertUser();
  const create = await request(app).post('/api/groups').set('Authorization', authHeader(creator)).send({ name: 'Interest Club', kind: 'interest' });
  const groupId = create.body.group.id;

  const denied = await request(app)
    .post(`/api/groups/${groupId}/posts`)
    .set('Authorization', authHeader(outsider))
    .send({ body: 'Not a member' });
  expect(denied.status).toBe(403);

  const allowed = await request(app)
    .post(`/api/groups/${groupId}/posts`)
    .set('Authorization', authHeader(creator))
    .send({ body: 'Hello group' });
  expect(allowed.status).toBe(201);

  const posts = await request(app).get(`/api/groups/${groupId}/posts`).set('Authorization', authHeader(creator));
  expect(posts.body.posts[0].author_name).toBe('Creator Name');
});

test('GET /api/groups/:id with a non-numeric id returns 500, not a crash', async () => {
  const user = await insertUser();
  const res = await request(app).get('/api/groups/not-a-number').set('Authorization', authHeader(user));
  expect(res.status).toBe(500);
  expect(res.body.error).toBeTruthy();
});
