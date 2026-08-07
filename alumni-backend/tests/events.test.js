const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('POST /api/events requires admin', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(alumni))
    .send({ title: 'Reunion', event_date: '2026-12-01T18:00:00Z' });
  expect(res.status).toBe(403);
});

test('GET /api/events is public (no auth required)', async () => {
  const res = await request(app).get('/api/events');
  expect(res.status).toBe(200);
});

test('admin can create an event, anyone can list and get it', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ role: 'alumni' });

  const create = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Reunion 2026', location: 'Gym', event_date: '2026-12-01T18:00:00Z', description: 'Annual reunion' });
  expect(create.status).toBe(201);
  const eventId = create.body.event.id;

  const list = await request(app).get('/api/events').set('Authorization', authHeader(alumni));
  expect(list.status).toBe(200);
  expect(list.body.events.some((e) => e.id === eventId)).toBe(true);

  const detail = await request(app).get(`/api/events/${eventId}`).set('Authorization', authHeader(alumni));
  expect(detail.status).toBe(200);
  expect(detail.body.event.title).toBe('Reunion 2026');
});

test('alumni can RSVP and see counts + their own status', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ role: 'alumni' });
  const create = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Meetup', event_date: '2026-12-01T18:00:00Z' });
  const eventId = create.body.event.id;

  const rsvp = await request(app)
    .post(`/api/events/${eventId}/rsvp`)
    .set('Authorization', authHeader(alumni))
    .send({ status: 'going' });
  expect(rsvp.status).toBe(200);

  const rsvpAgain = await request(app)
    .post(`/api/events/${eventId}/rsvp`)
    .set('Authorization', authHeader(alumni))
    .send({ status: 'maybe' });
  expect(rsvpAgain.status).toBe(200);

  const status = await request(app)
    .get(`/api/events/${eventId}/rsvp`)
    .set('Authorization', authHeader(alumni));
  expect(status.body.myStatus).toBe('maybe');
  expect(status.body.counts.maybe).toBe(1);
  expect(status.body.counts.going).toBe(0);
});

test('DELETE /api/events/:id requires admin', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ role: 'alumni' });
  const create = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'To Delete', event_date: '2026-12-01T18:00:00Z' });
  const eventId = create.body.event.id;

  const denied = await request(app).delete(`/api/events/${eventId}`).set('Authorization', authHeader(alumni));
  expect(denied.status).toBe(403);

  const allowed = await request(app).delete(`/api/events/${eventId}`).set('Authorization', authHeader(admin));
  expect(allowed.status).toBe(204);
});
