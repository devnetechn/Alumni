const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb, createSchool, hostFor, insertUser, authHeader, getDefaultSchool } = require('./helpers');

afterAll(() => pool.end());

describe('GET /api/school', () => {
  beforeEach(resetDb);

  test('returns the resolved school\'s name and logo, no auth required', async () => {
    const school = await createSchool({ name: 'Logo Test School' });
    await query('UPDATE schools SET logo = $1 WHERE id = $2', ['data:image/jpeg;base64,xyz', school.id]);

    const res = await request(app).get('/api/school').set('Host', hostFor(school));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Logo Test School');
    expect(res.body.logo).toBe('data:image/jpeg;base64,xyz');
  });

  test('logo is null when the school has none', async () => {
    const school = await createSchool();
    const res = await request(app).get('/api/school').set('Host', hostFor(school));
    expect(res.status).toBe(200);
    expect(res.body.logo).toBeNull();
  });

  test('unknown subdomain still returns 404, same as any other route', async () => {
    const res = await request(app).get('/api/school').set('Host', 'nonexistent-school.example.com');
    expect(res.status).toBe(404);
  });
});

describe('overview fields', () => {
  beforeEach(resetDb);

  test('admin can set the overview and it is public on GET /api/school', async () => {
    const admin = await insertUser({ role: 'admin' });
    const patch = await request(app)
      .patch('/api/school')
      .set('Authorization', authHeader(admin))
      .send({ overview_title: 'Reconnecting', overview_body: 'Proof of life' });
    expect(patch.status).toBe(200);

    const school = await getDefaultSchool();
    const res = await request(app).get('/api/school').set('Host', hostFor(school));
    expect(res.body.overview_title).toBe('Reconnecting');
    expect(res.body.overview_body).toBe('Proof of life');
    expect(res.body.overview_image).toBeNull();
  });

  test('alumni cannot set the overview', async () => {
    const alumni = await insertUser({ role: 'alumni' });
    const res = await request(app)
      .patch('/api/school')
      .set('Authorization', authHeader(alumni))
      .send({ overview_title: 'Nope' });
    expect(res.status).toBe(403);
  });
});
