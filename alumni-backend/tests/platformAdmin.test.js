const request = require('supertest');
const { app } = require('../src/server');
const { pool, platformPool, query } = require('../src/db');
const { resetDb, createSchool, insertUser } = require('./helpers');

afterAll(() => Promise.all([pool.end(), platformPool.end()]));

async function bootstrap() {
  const res = await request(app).post('/api/platform/admin/signup').send({
    email: 'master@platform.test',
    password: 'password123',
  });
  return res.body.token;
}

describe('platform admin bootstrap', () => {
  beforeEach(resetDb);

  test('first signup succeeds and creates exactly one row', async () => {
    const res = await request(app).post('/api/platform/admin/signup').send({
      email: 'master@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    const rows = await query('SELECT * FROM platform_admins');
    expect(rows).toHaveLength(1);
  });

  test('a second signup attempt is rejected once one exists', async () => {
    await bootstrap();
    const res = await request(app).post('/api/platform/admin/signup').send({
      email: 'second@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(403);
    const rows = await query('SELECT * FROM platform_admins');
    expect(rows).toHaveLength(1);
  });

  test('signup works again after the existing admin is removed (fresh install)', async () => {
    await bootstrap();
    await query('DELETE FROM platform_admins');
    const res = await request(app).post('/api/platform/admin/signup').send({
      email: 'again@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(201);
  });
});

describe('platform admin login', () => {
  beforeEach(resetDb);

  test('wrong password is rejected', async () => {
    await bootstrap();
    const res = await request(app).post('/api/platform/admin/login').send({
      email: 'master@platform.test',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  test('correct credentials return a token', async () => {
    await bootstrap();
    const res = await request(app).post('/api/platform/admin/login').send({
      email: 'master@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('GET /api/platform/admin/schools', () => {
  beforeEach(resetDb);

  test('returns every school with correct alumni/event counts, across schools', async () => {
    const token = await bootstrap();
    const schoolA = await createSchool({ name: 'School A' });
    const schoolB = await createSchool({ name: 'School B' });
    await insertUser({ school_id: schoolA.id });
    await insertUser({ school_id: schoolA.id });
    await insertUser({ school_id: schoolB.id });
    await query(
      `INSERT INTO events (school_id, title, event_date) VALUES ($1, 'Event A', now())`,
      [schoolA.id]
    );

    const res = await request(app)
      .get('/api/platform/admin/schools')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const a = res.body.schools.find((s) => s.slug === schoolA.slug);
    const b = res.body.schools.find((s) => s.slug === schoolB.slug);
    expect(a.alumni_count).toBe(2);
    expect(a.event_count).toBe(1);
    expect(b.alumni_count).toBe(1);
    expect(b.event_count).toBe(0);
  });

  test('rejects a request with no platform-admin token', async () => {
    const res = await request(app).get('/api/platform/admin/schools');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/platform/admin/schools/:id', () => {
  beforeEach(resetDb);

  test('active updates only the targeted school', async () => {
    const token = await bootstrap();
    const schoolA = await createSchool();
    const schoolB = await createSchool();

    const res = await request(app)
      .patch(`/api/platform/admin/schools/${schoolA.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.school.active).toBe(false);
    const untouchedRows = await query('SELECT active FROM schools WHERE id = $1', [schoolB.id]);
    expect(untouchedRows[0].active).toBe(true);
  });

  test('plan active sets the plan column', async () => {
    const token = await bootstrap();
    const school = await createSchool();
    const res = await request(app)
      .patch(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'active' });
    expect(res.body.school.plan).toBe('active');
  });

  test('extendTrialDays pushes trial_ends_at forward', async () => {
    const token = await bootstrap();
    const school = await createSchool();
    const before = await query('SELECT trial_ends_at FROM schools WHERE id = $1', [school.id]);

    const res = await request(app)
      .patch(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ extendTrialDays: 30 });

    expect(new Date(res.body.school.trial_ends_at).getTime()).toBeGreaterThan(new Date(before[0].trial_ends_at).getTime());
  });
});

describe('DELETE /api/platform/admin/schools/:id', () => {
  beforeEach(resetDb);

  test('correct confirmSlug deletes the school and its data', async () => {
    const token = await bootstrap();
    const school = await createSchool();
    await insertUser({ school_id: school.id });

    const res = await request(app)
      .delete(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmSlug: school.slug });

    expect(res.status).toBe(204);
    const schoolRows = await query('SELECT * FROM schools WHERE id = $1', [school.id]);
    expect(schoolRows).toHaveLength(0);
    const userRows = await query('SELECT * FROM users WHERE school_id = $1', [school.id]);
    expect(userRows).toHaveLength(0);
  });

  test('mismatched confirmSlug leaves the school untouched', async () => {
    const token = await bootstrap();
    const school = await createSchool();

    const res = await request(app)
      .delete(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmSlug: 'wrong-slug' });

    expect(res.status).toBe(400);
    const schoolRows = await query('SELECT * FROM schools WHERE id = $1', [school.id]);
    expect(schoolRows).toHaveLength(1);
  });
});
