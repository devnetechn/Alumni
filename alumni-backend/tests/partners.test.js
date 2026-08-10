const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('GET /api/partners is public and starts empty', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/partners').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.partners).toEqual([]);
});

test('POST /api/partners requires admin', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(alumni))
    .send({ name: 'Not Allowed' });
  expect(res.status).toBe(403);
});

test('POST /api/partners requires a name', async () => {
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ website_url: 'https://example.com' });
  expect(res.status).toBe(400);
});

test('admin can create a partner without a logo, then delete it', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Local Bakery', website_url: 'https://example.com' });
  expect(create.status).toBe(201);
  expect(create.body.partner.name).toBe('Local Bakery');
  expect(create.body.partner.logo).toBeNull();

  const school = await getDefaultSchool();
  const list = await request(app).get('/api/partners').set('Host', hostFor(school));
  expect(list.body.partners.length).toBe(1);

  const del = await request(app)
    .delete(`/api/partners/${create.body.partner.id}`)
    .set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);

  const listAfter = await request(app).get('/api/partners').set('Host', hostFor(school));
  expect(listAfter.body.partners.length).toBe(0);
});

test('admin can create a partner with a logo', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Tech Co', logo: 'data:image/jpeg;base64,ZmFrZQ==' });
  expect(create.status).toBe(201);
  expect(create.body.partner.logo).toBe('data:image/jpeg;base64,ZmFrZQ==');
});

test('DELETE /api/partners/:id requires admin', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ role: 'alumni' });
  const create = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Protected Co' });

  const res = await request(app)
    .delete(`/api/partners/${create.body.partner.id}`)
    .set('Authorization', authHeader(alumni));
  expect(res.status).toBe(403);
});
