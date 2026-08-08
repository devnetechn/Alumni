const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool } = require('./helpers');
const { backfill } = require('../scripts/backfill-rsvp-paid');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeEvent(schoolId) {
  const rows = await pool.query(
    `INSERT INTO events (school_id, title, event_date) VALUES ($1,$2,$3) RETURNING id`,
    [schoolId, 'Gala', '2026-12-01T18:00:00Z']
  );
  return rows.rows[0].id;
}

async function makeRsvp({ eventId, schoolId, userId, paid }) {
  await pool.query(
    `INSERT INTO event_rsvps (school_id, event_id, user_id, status, paid) VALUES ($1,$2,$3,'going',$4)`,
    [schoolId, eventId, userId, paid]
  );
}

test('backfill sets paid=true for an unpaid RSVP from a user in good standing', async () => {
  const school = await getDefaultSchool();
  const eventId = await makeEvent(school.id);
  const user = await insertUser({ registration_paid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
  await makeRsvp({ eventId, schoolId: school.id, userId: user.id, paid: false });

  const count = await backfill(pool);

  expect(count).toBe(1);
  const rows = await pool.query('SELECT paid FROM event_rsvps WHERE user_id = $1', [user.id]);
  expect(rows.rows[0].paid).toBe(true);
});

test('backfill does not touch an unpaid RSVP from a user with an expired registration', async () => {
  const school = await getDefaultSchool();
  const eventId = await makeEvent(school.id);
  const user = await insertUser({ registration_paid_until: new Date(Date.now() - 1000).toISOString() });
  await makeRsvp({ eventId, schoolId: school.id, userId: user.id, paid: false });

  const count = await backfill(pool);

  expect(count).toBe(0);
  const rows = await pool.query('SELECT paid FROM event_rsvps WHERE user_id = $1', [user.id]);
  expect(rows.rows[0].paid).toBe(false);
});

test('backfill leaves an already-paid RSVP alone', async () => {
  const school = await getDefaultSchool();
  const eventId = await makeEvent(school.id);
  const user = await insertUser({ registration_paid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
  await makeRsvp({ eventId, schoolId: school.id, userId: user.id, paid: true });

  const count = await backfill(pool);

  expect(count).toBe(0);
});
