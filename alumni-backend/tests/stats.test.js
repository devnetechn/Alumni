const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, queryForSchool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');
const { getCoreCounts } = require('../src/routes/stats');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('GET /api/stats returns all expected aggregate shapes', async () => {
  const school = await getDefaultSchool();
  const admin = await insertUser({ role: 'admin', batch_year: 2020, industry: 'Tech', company: 'Acme' });
  await insertUser({ batch_year: 2021, industry: 'Finance', company: 'Acme', course: 'BSIT' });
  await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Event 1', event_date: new Date().toISOString() });

  const res = await request(app).get('/api/stats').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.totalAlumni).toBe(2);
  expect(res.body.totalEvents).toBe(1);
  expect(typeof res.body.totalCheckins).toBe('number');
  expect(typeof res.body.totalMessages).toBe('number');
  expect(Array.isArray(res.body.registrationsTrend)).toBe(true);
  expect(res.body.registrationsTrend.length).toBe(12);
  expect(Array.isArray(res.body.checkinsTrend)).toBe(true);
  expect(res.body.byBatch.some((b) => b.label === '2020')).toBe(true);
  expect(res.body.byIndustry.some((i) => i.label === 'Tech')).toBe(true);
  expect(res.body.topCompanies[0].label).toBe('Acme');
  expect(res.body.topCompanies[0].value).toBe(2);
  expect(res.body.byCourse.some((c) => c.label === 'BSIT')).toBe(true);
  expect(Array.isArray(res.body.eventsByMonth)).toBe(true);
});

test('GET /api/stats eventsByMonth includes future events, not just past ones', async () => {
  const school = await getDefaultSchool();
  const admin = await insertUser({ role: 'admin' });
  const future = new Date();
  future.setUTCMonth(future.getUTCMonth() + 3);
  await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Future Event', event_date: future.toISOString() });

  const res = await request(app).get('/api/stats').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.eventsByMonth.length).toBe(12);
  const total = res.body.eventsByMonth.reduce((sum, m) => sum + m.value, 0);
  expect(total).toBeGreaterThan(0);
});

test('getCoreCounts returns totalAlumni excluding bot accounts, and totalEvents', async () => {
  const school = await getDefaultSchool();
  await insertUser({ batch_year: 2020 });
  await insertUser({ is_bot: true, email: 'bot@ihes.local', full_name: 'IHES Assistant' });
  const db = (text, params) => queryForSchool(school.id, text, params);
  const counts = await getCoreCounts(db);
  expect(counts.totalAlumni).toBe(1);
  expect(counts.totalEvents).toBe(0);
});
