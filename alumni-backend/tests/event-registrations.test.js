const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

async function makeEventWithRsvp({ paid, status = 'going' } = {}) {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ full_name: 'Attendee One', nfc_uid: 'NFC123' });
  const create = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Gala', event_date: '2026-12-01T18:00:00Z' });
  const eventId = create.body.event.id;
  await request(app)
    .post(`/api/events/${eventId}/rsvp`)
    .set('Authorization', authHeader(alumni))
    .send({ status });
  if (paid) {
    await request(app)
      .patch(`/api/events/${eventId}/registrations/${alumni.id}`)
      .set('Authorization', authHeader(admin))
      .send({ paid: true });
  }
  return { admin, alumni, eventId };
}

test('GET /registrations is admin-only and lists RSVP + payment status', async () => {
  const { admin, alumni, eventId } = await makeEventWithRsvp();
  const denied = await request(app).get(`/api/events/${eventId}/registrations`).set('Authorization', authHeader(alumni));
  expect(denied.status).toBe(403);

  const res = await request(app).get(`/api/events/${eventId}/registrations`).set('Authorization', authHeader(admin));
  expect(res.status).toBe(200);
  expect(res.body.registrations[0].full_name).toBe('Attendee One');
  expect(res.body.registrations[0].paid).toBe(false);
});

test('PATCH /registrations/:alumniId toggles paid', async () => {
  const { admin, alumni, eventId } = await makeEventWithRsvp();
  const res = await request(app)
    .patch(`/api/events/${eventId}/registrations/${alumni.id}`)
    .set('Authorization', authHeader(admin))
    .send({ paid: true });
  expect(res.status).toBe(200);
  expect(res.body.registration.paid).toBe(true);
});

test('POST /checkin rejects an alumni who has not RSVPd going + paid', async () => {
  const { admin, alumni, eventId } = await makeEventWithRsvp({ paid: false });
  const res = await request(app)
    .post(`/api/events/${eventId}/checkin`)
    .set('Authorization', authHeader(admin))
    .send({ code: `ALUMNI:${alumni.id}` });
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/RSVP|paid/i);
});

test('POST /checkin succeeds for a paid+going alumni, scanned by an officer or admin', async () => {
  const { admin, alumni, eventId } = await makeEventWithRsvp({ paid: true });
  const officer = await insertUser({ is_batch_leader: true });

  const byOfficer = await request(app)
    .post(`/api/events/${eventId}/checkin`)
    .set('Authorization', authHeader(officer))
    .send({ code: alumni.nfc_uid });
  expect(byOfficer.status).toBe(201);

  const list = await request(app).get(`/api/events/${eventId}/checkin`).set('Authorization', authHeader(admin));
  expect(list.body.attendance.some((a) => a.full_name === 'Attendee One')).toBe(true);
});

test('POST /checkin is rejected for a plain alumni (not officer/admin)', async () => {
  const { alumni, eventId } = await makeEventWithRsvp({ paid: true });
  const plainAlumni = await insertUser();
  const res = await request(app)
    .post(`/api/events/${eventId}/checkin`)
    .set('Authorization', authHeader(plainAlumni))
    .send({ code: `ALUMNI:${alumni.id}` });
  expect(res.status).toBe(403);
});

test('GET /export returns CSV content', async () => {
  const { admin, alumni, eventId } = await makeEventWithRsvp({ paid: true });
  await request(app)
    .post(`/api/events/${eventId}/checkin`)
    .set('Authorization', authHeader(admin))
    .send({ code: `ALUMNI:${alumni.id}` });
  const res = await request(app).get(`/api/events/${eventId}/export`).set('Authorization', authHeader(admin));
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/csv/);
  expect(res.text).toContain('Attendee One');
});
