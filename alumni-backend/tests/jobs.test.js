const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('GET /api/jobs is public and includes poster info', async () => {
  const school = await getDefaultSchool();
  const poster = await insertUser({ full_name: 'Poster Person' });
  await request(app)
    .post('/api/jobs')
    .set('Authorization', authHeader(poster))
    .send({ title: 'Backend Dev', company: 'Acme', job_type: 'job' });

  const res = await request(app).get('/api/jobs').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.jobs[0].poster_name).toBe('Poster Person');
});

test('GET /api/jobs?type=internship filters by job_type', async () => {
  const school = await getDefaultSchool();
  const poster = await insertUser();
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Job A', job_type: 'job' });
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Intern A', job_type: 'internship' });

  const res = await request(app).get('/api/jobs').query({ type: 'internship' }).set('Host', hostFor(school));
  expect(res.body.jobs.length).toBe(1);
  expect(res.body.jobs[0].title).toBe('Intern A');
});

test('POST /api/jobs requires auth', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).post('/api/jobs').set('Host', hostFor(school)).send({ title: 'No Auth Job' });
  expect(res.status).toBe(401);
});

test('DELETE /api/jobs/:id allowed for the original poster', async () => {
  const poster = await insertUser();
  const create = await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Mine' });
  const res = await request(app).delete(`/api/jobs/${create.body.job.id}`).set('Authorization', authHeader(poster));
  expect(res.status).toBe(204);
});

test('DELETE /api/jobs/:id rejected for a different non-admin user', async () => {
  const poster = await insertUser();
  const other = await insertUser();
  const create = await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Not Yours' });
  const res = await request(app).delete(`/api/jobs/${create.body.job.id}`).set('Authorization', authHeader(other));
  expect(res.status).toBe(403);
});

test('DELETE /api/jobs/:id allowed for admin regardless of poster', async () => {
  const poster = await insertUser();
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Admin Can Delete' });
  const res = await request(app).delete(`/api/jobs/${create.body.job.id}`).set('Authorization', authHeader(admin));
  expect(res.status).toBe(204);
});
