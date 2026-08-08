const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeEventWithRsvp({ paid = false, status = 'going' } = {}) {
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
  // POST /rsvp now auto-marks paid=true for a fresh RSVP (see events.js) --
  // explicitly set the requested value either way so this fixture's
  // "unpaid" case still means unpaid.
  await request(app)
    .patch(`/api/events/${eventId}/registrations/${alumni.id}`)
    .set('Authorization', authHeader(admin))
    .send({ paid });
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

test('POST /checkin response includes trimmed alumni details, not sensitive fields', async () => {
  const { alumni, eventId } = await makeEventWithRsvp({ paid: true });
  const officer = await insertUser({ is_batch_leader: true });

  const res = await request(app)
    .post(`/api/events/${eventId}/checkin`)
    .set('Authorization', authHeader(officer))
    .send({ code: `ALUMNI:${alumni.id}` });

  expect(res.status).toBe(201);
  expect(res.body.alumni).toEqual({
    id: alumni.id,
    full_name: 'Attendee One',
    profile_pic: null,
    batch_year: 2020,
    course: 'BSCS',
  });
  expect(res.body.alumni.password_hash).toBeUndefined();
  expect(res.body.alumni.email).toBeUndefined();
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

test('POST /rsvp auto-marks paid=true for an alumni in good standing', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ registration_paid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
  const create = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Gala', event_date: '2026-12-01T18:00:00Z' });
  const eventId = create.body.event.id;

  const res = await request(app)
    .post(`/api/events/${eventId}/rsvp`)
    .set('Authorization', authHeader(alumni))
    .send({ status: 'going' });

  expect(res.status).toBe(200);
  expect(res.body.rsvp.paid).toBe(true);
});

test('changing RSVP status does not reset an admin-overridden paid value', async () => {
  const { alumni, eventId, admin } = await makeEventWithRsvp({ paid: true });
  await request(app)
    .patch(`/api/events/${eventId}/registrations/${alumni.id}`)
    .set('Authorization', authHeader(admin))
    .send({ paid: false });

  const res = await request(app)
    .post(`/api/events/${eventId}/rsvp`)
    .set('Authorization', authHeader(alumni))
    .send({ status: 'maybe' });

  expect(res.status).toBe(200);
  expect(res.body.rsvp.status).toBe('maybe');
  expect(res.body.rsvp.paid).toBe(false);
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

test('GET /export properly escapes CSV fields with commas and quotes', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ full_name: 'Smith, John "JJ" Jr.', nfc_uid: 'NFC999', course: 'Eng, Comp' });
  const create = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Gala', event_date: '2026-12-01T18:00:00Z' });
  const eventId = create.body.event.id;
  await request(app)
    .post(`/api/events/${eventId}/rsvp`)
    .set('Authorization', authHeader(alumni))
    .send({ status: 'going' });
  await request(app)
    .patch(`/api/events/${eventId}/registrations/${alumni.id}`)
    .set('Authorization', authHeader(admin))
    .send({ paid: true });
  await request(app)
    .post(`/api/events/${eventId}/checkin`)
    .set('Authorization', authHeader(admin))
    .send({ code: alumni.nfc_uid });

  const res = await request(app).get(`/api/events/${eventId}/export`).set('Authorization', authHeader(admin));
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/csv/);

  // Verify field is properly quoted and escaped
  expect(res.text).toContain('"Smith, John ""JJ"" Jr."');
  // Verify course field is also properly escaped
  expect(res.text).toContain('"Eng, Comp"');

  // Verify the CSV structure is intact (header line should have 4 columns)
  const lines = res.text.trim().split('\n');
  expect(lines.length).toBe(2); // header + 1 data row
  expect(lines[0]).toMatch(/Name,Batch,Course,Checked In At/);
});
