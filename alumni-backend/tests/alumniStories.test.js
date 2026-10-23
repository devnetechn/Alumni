const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

const post = (admin, body) => request(app).post('/api/alumni-stories').set('Authorization', authHeader(admin)).send(body);

test('GET /api/alumni-stories is public and starts empty', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/alumni-stories').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.stories).toEqual([]);
});

test('POST requires admin and a name', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  expect((await post(alumni, { name: 'X' })).status).toBe(403);
  const admin = await insertUser({ role: 'admin' });
  expect((await post(admin, { quote: 'no name' })).status).toBe(400);
});

test('admin creates, filters by featured, patches and deletes', async () => {
  const admin = await insertUser({ role: 'admin' });
  const school = await getDefaultSchool();
  const a = await post(admin, { name: 'Maria', batch_label: 'Batch 2015', role_title: 'Founder', quote: 'Hi', story: 'Long story' });
  const b = await post(admin, { name: 'Jon', featured: false });
  expect(a.status).toBe(201);
  expect(a.body.story.featured).toBe(true);

  const featured = await request(app).get('/api/alumni-stories?featured=true').set('Host', hostFor(school));
  expect(featured.body.stories.map((s) => s.name)).toEqual(['Maria']);

  const patch = await request(app).patch(`/api/alumni-stories/${b.body.story.id}`).set('Authorization', authHeader(admin)).send({ featured: true });
  expect(patch.body.story.featured).toBe(true);

  const del = await request(app).delete(`/api/alumni-stories/${a.body.story.id}`).set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
});

test('GET /:id 404s on unknown or non-numeric ids', async () => {
  const admin = await insertUser({ role: 'admin' });
  const school = await getDefaultSchool();
  const created = await post(admin, { name: 'Ana' });
  const ok = await request(app).get(`/api/alumni-stories/${created.body.story.id}`).set('Host', hostFor(school));
  expect(ok.status).toBe(200);
  expect(ok.body.story.name).toBe('Ana');
  expect((await request(app).get('/api/alumni-stories/999999').set('Host', hostFor(school))).status).toBe(404);
  expect((await request(app).get('/api/alumni-stories/abc').set('Host', hostFor(school))).status).toBe(404);
});
