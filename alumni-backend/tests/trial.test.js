const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb, insertUser, authHeader, createSchool, hostFor } = require('./helpers');

afterAll(() => pool.end());

describe('trial expiry enforcement', () => {
  beforeEach(resetDb);

  test('a request from a school past trial_ends_at gets 402 on a normal route', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/events')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('Trial expired');
  });

  test('login still succeeds for an expired-trial school', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const password_hash = await require('../src/lib/password').hashPassword('password123');
    await query(
      `INSERT INTO users (school_id, email, password_hash) VALUES ($1, 'trial@test.com', $2)`,
      [school.id, password_hash]
    );

    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', hostFor(school))
      .send({ email: 'trial@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('/api/me stays reachable for an expired-trial school', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/me')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
  });

  test('a school on an active plan is never blocked, even past trial_ends_at', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET plan = 'active', trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/events')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
  });

  test('a school still within its trial window is not blocked', async () => {
    const school = await createSchool();
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/events')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
  });
});
