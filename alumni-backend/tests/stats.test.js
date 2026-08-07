const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/stats returns all expected aggregate shapes', async () => {
  const admin = await insertUser({ role: 'admin', batch_year: 2020, industry: 'Tech', company: 'Acme' });
  await insertUser({ batch_year: 2021, industry: 'Finance', company: 'Acme', course: 'BSIT' });
  await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Event 1', event_date: new Date().toISOString() });

  const res = await request(app).get('/api/stats');
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
