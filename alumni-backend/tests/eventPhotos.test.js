const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, authHeader, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeEvent({ pastEvent = true } = {}) {
  const school = await getDefaultSchool();
  const eventDate = pastEvent ? '2020-01-01T18:00:00Z' : '2099-01-01T18:00:00Z';
  const rows = await pool.query(
    `INSERT INTO events (school_id, title, event_date) VALUES ($1,$2,$3) RETURNING id`,
    [school.id, pastEvent ? 'Old Gala' : 'Future Gala', eventDate]
  );
  return rows.rows[0].id;
}

test('POST /:id/photos requires officer/admin', async () => {
  const eventId = await makeEvent();
  const plainAlumni = await insertUser();

  const res = await request(app)
    .post(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(plainAlumni))
    .send({ media: 'data:image/jpeg;base64,AAAA', media_type: 'image' });

  expect(res.status).toBe(403);
});

test('POST /:id/photos creates a photo row for an officer', async () => {
  const eventId = await makeEvent();
  const officer = await insertUser({ is_batch_leader: true });

  const res = await request(app)
    .post(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:image/jpeg;base64,AAAA', media_type: 'image' });

  expect(res.status).toBe(201);
  expect(res.body.photo.media_type).toBe('image');

  const list = await request(app)
    .get(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer));
  expect(list.body.photos.length).toBe(1);
});

test('DELETE /:id/photos/:photoId removes a photo, scoped to the right event', async () => {
  const eventId = await makeEvent();
  const otherEventId = await makeEvent();
  const officer = await insertUser({ is_batch_leader: true });

  const created = await request(app)
    .post(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:video/mp4;base64,AAAA', media_type: 'video' });
  const photoId = created.body.photo.id;

  const wrongScope = await request(app)
    .delete(`/api/events/${otherEventId}/photos/${photoId}`)
    .set('Authorization', authHeader(officer));
  expect(wrongScope.status).toBe(404);

  const rightScope = await request(app)
    .delete(`/api/events/${eventId}/photos/${photoId}`)
    .set('Authorization', authHeader(officer));
  expect(rightScope.status).toBe(204);

  const list = await request(app)
    .get(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer));
  expect(list.body.photos.length).toBe(0);
});

test('GET /highlights requires no auth and only returns past-event media', async () => {
  const pastEventId = await makeEvent({ pastEvent: true });
  const futureEventId = await makeEvent({ pastEvent: false });
  const officer = await insertUser({ is_batch_leader: true });

  await request(app)
    .post(`/api/events/${pastEventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:image/jpeg;base64,PAST', media_type: 'image' });
  await request(app)
    .post(`/api/events/${futureEventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:image/jpeg;base64,FUTURE', media_type: 'image' });

  const school = await getDefaultSchool();
  const res = await request(app).get('/api/events/highlights').set('Host', hostFor(school));

  expect(res.status).toBe(200);
  expect(res.body.highlights.length).toBe(1);
  expect(res.body.highlights[0].media).toBe('data:image/jpeg;base64,PAST');
  expect(res.body.highlights[0].event_title).toBe('Old Gala');
});
