const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('GET /api/officers is public and starts empty', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/officers').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.officers).toEqual([]);
});

test('POST /api/officers requires admin', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .post('/api/officers')
    .set('Authorization', authHeader(alumni))
    .send({ name: 'Not Allowed', position: 'President' });
  expect(res.status).toBe(403);
});

test('POST /api/officers requires a name and position', async () => {
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app)
    .post('/api/officers')
    .set('Authorization', authHeader(admin))
    .send({ name: 'No Position' });
  expect(res.status).toBe(400);
});

test('admin can create an officer without a photo, then delete it', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/officers')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Maria Santos', position: 'President' });
  expect(create.status).toBe(201);
  expect(create.body.officer.name).toBe('Maria Santos');
  expect(create.body.officer.position).toBe('President');
  expect(create.body.officer.photo).toBeNull();

  const school = await getDefaultSchool();
  const list = await request(app).get('/api/officers').set('Host', hostFor(school));
  expect(list.body.officers.length).toBe(1);

  const del = await request(app)
    .delete(`/api/officers/${create.body.officer.id}`)
    .set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);

  const listAfter = await request(app).get('/api/officers').set('Host', hostFor(school));
  expect(listAfter.body.officers.length).toBe(0);
});

test('admin can create an officer with a photo', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/officers')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Jon Dela Cruz', position: 'Treasurer', photo: 'data:image/jpeg;base64,ZmFrZQ==' });
  expect(create.status).toBe(201);
  expect(create.body.officer.photo).toBe('data:image/jpeg;base64,ZmFrZQ==');
});

test('DELETE /api/officers/:id requires admin', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ role: 'alumni' });
  const create = await request(app)
    .post('/api/officers')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Protected Officer', position: 'Secretary' });

  const res = await request(app)
    .delete(`/api/officers/${create.body.officer.id}`)
    .set('Authorization', authHeader(alumni));
  expect(res.status).toBe(403);
});
