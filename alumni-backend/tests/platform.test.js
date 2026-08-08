const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb } = require('./helpers');

afterAll(() => pool.end());

describe('POST /api/platform/schools', () => {
  beforeEach(resetDb);

  test('creates exactly one school and one admin user scoped to it', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'New School',
      slug: 'new-school',
      full_name: 'First Admin',
      email: 'admin@new-school.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('new-school');

    const schools = await query('SELECT * FROM schools WHERE slug = $1', ['new-school']);
    expect(schools).toHaveLength(1);
    expect(schools[0].plan).toBe('trial');
    expect(new Date(schools[0].trial_ends_at).getTime()).toBeGreaterThan(Date.now());

    const users = await query('SELECT * FROM users WHERE school_id = $1', [schools[0].id]);
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('admin');
    expect(users[0].email).toBe('admin@new-school.com');
  });

  test('stores the logo when provided', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Logo School',
      slug: 'logo-school',
      logo: 'data:image/jpeg;base64,abc123',
      email: 'admin@logo-school.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    const schools = await query('SELECT logo FROM schools WHERE slug = $1', ['logo-school']);
    expect(schools[0].logo).toBe('data:image/jpeg;base64,abc123');
  });

  test('rejects a reserved slug', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Admin Panel',
      slug: 'admin',
      email: 'a@b.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  test('rejects a malformed slug', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Bad Slug',
      slug: 'Not Valid!',
      email: 'a@b.com',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  test('rejects a duplicate slug', async () => {
    await request(app).post('/api/platform/schools').send({
      name: 'First', slug: 'dupe-school', email: 'a@b.com', password: 'password123',
    });
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Second', slug: 'dupe-school', email: 'c@d.com', password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  test('missing required fields returns 400', async () => {
    const res = await request(app).post('/api/platform/schools').send({ name: 'No Slug' });
    expect(res.status).toBe(400);
  });
});
