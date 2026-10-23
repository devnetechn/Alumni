const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

const post = (admin, body) => request(app).post('/api/projects').set('Authorization', authHeader(admin)).send(body);

test('GET /api/projects is public and starts empty', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/projects').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.projects).toEqual([]);
});

test('POST requires admin and a title', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  expect((await post(alumni, { title: 'X' })).status).toBe(403);
  const admin = await insertUser({ role: 'admin' });
  expect((await post(admin, { summary: 'no title' })).status).toBe(400);
});

test('admin creates, filters by featured, patches and deletes', async () => {
  const admin = await insertUser({ role: 'admin' });
  const school = await getDefaultSchool();
  const a = await post(admin, { title: 'Library', summary: 'New library', featured: true });
  const b = await post(admin, { title: 'Scholarship', featured: false });
  expect(a.status).toBe(201);
  expect(a.body.project.featured).toBe(true);

  const featured = await request(app).get('/api/projects?featured=true').set('Host', hostFor(school));
  expect(featured.body.projects.map((p) => p.title)).toEqual(['Library']);
  const all = await request(app).get('/api/projects').set('Host', hostFor(school));
  expect(all.body.projects.length).toBe(2);

  const patch = await request(app).patch(`/api/projects/${b.body.project.id}`).set('Authorization', authHeader(admin)).send({ featured: true, lead_name: 'Ana' });
  expect(patch.status).toBe(200);
  expect(patch.body.project.featured).toBe(true);
  expect(patch.body.project.lead_name).toBe('Ana');

  const del = await request(app).delete(`/api/projects/${a.body.project.id}`).set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
});

test('GET /:id returns the project with batch_name, 404 on unknown or non-numeric ids', async () => {
  const admin = await insertUser({ role: 'admin' });
  const school = await getDefaultSchool();
  const batch = (await pool.query(`INSERT INTO batches (school_id, year, name) VALUES ($1, 2005, 'Batch 2005') RETURNING id`, [school.id])).rows[0];
  const created = await post(admin, { title: 'Well', batch_id: batch.id });
  const ok = await request(app).get(`/api/projects/${created.body.project.id}`).set('Host', hostFor(school));
  expect(ok.status).toBe(200);
  expect(ok.body.project.batch_name).toBe('Batch 2005');
  expect((await request(app).get('/api/projects/999999').set('Host', hostFor(school))).status).toBe(404);
  expect((await request(app).get('/api/projects/abc').set('Host', hostFor(school))).status).toBe(404);
});

test('PATCH and DELETE 404 for unknown ids and PATCH with nothing to update is 400', async () => {
  const admin = await insertUser({ role: 'admin' });
  const created = await post(admin, { title: 'Keep' });
  const auth = authHeader(admin);
  expect((await request(app).patch('/api/projects/999999').set('Authorization', auth).send({ title: 'x' })).status).toBe(404);
  expect((await request(app).delete('/api/projects/999999').set('Authorization', auth)).status).toBe(404);
  expect((await request(app).patch(`/api/projects/${created.body.project.id}`).set('Authorization', auth).send({ bogus: 1 })).status).toBe(400);
});
