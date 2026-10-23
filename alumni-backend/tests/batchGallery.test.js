const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeBatch(year) {
  const school = await getDefaultSchool();
  const rows = await pool.query(
    `INSERT INTO batches (school_id, year, name) VALUES ($1,$2,$3) RETURNING id`,
    [school.id, year, `Batch ${year}`]
  );
  return rows.rows[0].id;
}

test('GET /api/batch-gallery is public and starts empty', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/batch-gallery').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.photos).toEqual([]);
});

test('POST requires admin', async () => {
  const batchId = await makeBatch(2010);
  const alumni = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .post('/api/batch-gallery')
    .set('Authorization', authHeader(alumni))
    .send({ batch_id: batchId, media: 'data:image/jpeg;base64,X' });
  expect(res.status).toBe(403);
});

test('POST validates media and batch', async () => {
  const batchId = await makeBatch(2010);
  const admin = await insertUser({ role: 'admin' });
  const post = (body) => request(app).post('/api/batch-gallery').set('Authorization', authHeader(admin)).send(body);
  expect((await post({ batch_id: batchId })).status).toBe(400);
  expect((await post({ media: 'data:image/jpeg;base64,X' })).status).toBe(400);
  expect((await post({ batch_id: 999999, media: 'data:image/jpeg;base64,X' })).status).toBe(404);
  expect((await post({ batch_id: 'abc', media: 'data:image/jpeg;base64,X' })).status).toBe(404);
});

test('admin can add photos, public list filters by batch_id, admin can delete', async () => {
  const b1 = await makeBatch(2010);
  const b2 = await makeBatch(2011);
  const admin = await insertUser({ role: 'admin' });
  const add = (batch_id, media) => request(app).post('/api/batch-gallery').set('Authorization', authHeader(admin)).send({ batch_id, media, caption: 'Hi' });

  const first = await add(b1, 'data:image/jpeg;base64,ONE');
  expect(first.status).toBe(201);
  await add(b2, 'data:image/jpeg;base64,TWO');

  const school = await getDefaultSchool();
  const all = await request(app).get('/api/batch-gallery').set('Host', hostFor(school));
  expect(all.body.photos.length).toBe(2);
  expect(all.body.photos[0].batch_name).toBeDefined();

  const filtered = await request(app).get(`/api/batch-gallery?batch_id=${b1}`).set('Host', hostFor(school));
  expect(filtered.body.photos.length).toBe(1);
  expect(filtered.body.photos[0].media).toBe('data:image/jpeg;base64,ONE');

  const del = await request(app).delete(`/api/batch-gallery/${first.body.photo.id}`).set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
  const again = await request(app).delete(`/api/batch-gallery/${first.body.photo.id}`).set('Authorization', authHeader(admin));
  expect(again.status).toBe(404);
});
