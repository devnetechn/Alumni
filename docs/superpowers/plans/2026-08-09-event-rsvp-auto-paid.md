# Event RSVP Auto-Paid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An alumni whose account is in good standing (registration fee paid, not expired) automatically gets `paid: true` on their event RSVP — no admin toggle needed — while admins keep the ability to manually override `paid` per alumni per event, and existing pre-change RSVP rows get fixed by a one-off backfill.

**Architecture:** `requireAuth` already blocks requests from users with an expired `registration_paid_until` before they reach any route handler (except a small allowlist that doesn't include the RSVP route). `POST /events/:id/rsvp` can therefore trust that anyone reaching it is in good standing, and set `paid: true` on the INSERT branch of its upsert without any new expiry check. A separate, manually-run, one-off script backfills existing rows — it is deliberately NOT part of `schema.sql` (which reruns in full on every `npm run migrate`), so it can never silently re-overwrite a future admin override.

**Tech Stack:** Express + `pg` (backend). Jest + Supertest for route tests, plain Jest for the backfill script. No new dependencies.

## Global Constraints

- `PATCH /events/:id/registrations/:alumniId` (the admin override route) must keep working exactly as today — unchanged.
- The `ON CONFLICT (event_id, user_id) DO UPDATE` branch of the RSVP upsert must only touch `status`, never `paid` — an existing `paid` value (admin-set or auto-set) must never be reset by a status change.
- The backfill script must not be wired into `db/schema.sql` or `scripts/migrate.js` — it must only run when explicitly invoked (`node scripts/backfill-rsvp-paid.js`), because `migrate.js` re-executes `schema.sql` in full on every run.
- The backfill must only flip rows currently `paid = false` for users in good standing (`registration_paid_until IS NULL OR registration_paid_until >= now()`) — it must never touch rows already `paid = true`, and must never touch rows for users with an expired `registration_paid_until`.

---

### Task 1: Auto-set `paid: true` when an alumni first RSVPs "going"

**Files:**
- Modify: `alumni-backend/src/routes/events.js:57-70`
- Test: `alumni-backend/tests/event-registrations.test.js`

**Interfaces:**
- Produces: `POST /api/events/:id/rsvp` response shape unchanged (`{ rsvp: {...} }`), but a freshly-inserted row now has `paid: true` instead of the previous default `false`. No other route's interface changes.

- [ ] **Step 1: Write the failing tests**

Add to `alumni-backend/tests/event-registrations.test.js` (this file already imports `request`, `app`, `pool`, `appPool`, `resetDb`, `insertUser`, `authHeader` — no new imports needed):

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/event-registrations.test.js -t "auto-marks paid|does not reset" --runInBand`
Expected: FAIL — the first test currently gets `paid: false` (the column's default); the second currently passes already (document this — it's the guard against a regression in Step 3, not a new failure).

- [ ] **Step 3: Implement the change**

In `alumni-backend/src/routes/events.js`, replace the `POST /:id/rsvp` handler's INSERT (currently):

```js
  const rows = await req.db(
    `INSERT INTO event_rsvps (school_id, event_id, user_id, status)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [req.school.id, req.params.id, req.user.id, status]
  );
```

with:

```js
  const rows = await req.db(
    `INSERT INTO event_rsvps (school_id, event_id, user_id, status, paid)
     VALUES ($1,$2,$3,$4, true)
     ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [req.school.id, req.params.id, req.user.id, status]
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/event-registrations.test.js --runInBand`
Expected: all tests in the file PASS (including the two new ones and every pre-existing one).

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/events.js alumni-backend/tests/event-registrations.test.js
git commit -m "feat(backend): auto-mark event RSVP paid for alumni in good standing"
```

---

### Task 2: One-off backfill script for existing RSVP rows

**Files:**
- Create: `alumni-backend/scripts/backfill-rsvp-paid.js`
- Test: `alumni-backend/tests/backfillRsvpPaid.test.js`

**Interfaces:**
- Consumes: a `pg.Pool`-shaped object (anything with an async `.query(text, params)` returning `{ rows, rowCount }` — matches both `new Pool(...)` used standalone and the `pool` export from `alumni-backend/src/db.js` used in tests).
- Produces: `backfill(pool): Promise<number>` — the count of rows updated. Exported alongside the script's `if (require.main === module)` standalone-run block, following the same pattern as `alumni-backend/db/seed.js`.

- [ ] **Step 1: Write the failing tests**

Create `alumni-backend/tests/backfillRsvpPaid.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/backfillRsvpPaid.test.js --runInBand`
Expected: FAIL — `Cannot find module '../scripts/backfill-rsvp-paid'` (the script doesn't exist yet).

- [ ] **Step 3: Implement the script**

Create `alumni-backend/scripts/backfill-rsvp-paid.js`:

```js
require('dotenv').config();
const { Pool } = require('pg');

async function backfill(pool) {
  const result = await pool.query(`
    UPDATE event_rsvps r
    SET paid = true
    FROM users u
    WHERE r.user_id = u.id
      AND r.paid = false
      AND (u.registration_paid_until IS NULL OR u.registration_paid_until >= now())
    RETURNING r.id
  `);
  return result.rowCount;
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  backfill(pool)
    .then((count) => {
      console.log(`Backfilled paid=true on ${count} existing RSVP row(s).`);
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { backfill };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/backfillRsvpPaid.test.js --runInBand`
Expected: all 3 tests PASS.

- [ ] **Step 5: Run the full backend suite**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest --runInBand`
Expected: all suites PASS (no regressions from Task 1 or Task 2).

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/scripts/backfill-rsvp-paid.js alumni-backend/tests/backfillRsvpPaid.test.js
git commit -m "feat(backend): add one-off backfill script for existing RSVP paid status"
```

- [ ] **Step 7: Run the backfill against the dev database**

Run (PowerShell): `Set-Location alumni-backend; node scripts/backfill-rsvp-paid.js`
Expected: prints `Backfilled paid=true on N existing RSVP row(s).` — this fixes the two pre-existing unpaid "going" RSVPs on the school's test event so a live check-in scan can now succeed without any manual admin toggle.
