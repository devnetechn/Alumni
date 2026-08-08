# Event RSVP: auto-mark "paid" from account standing

## Problem

Event check-in (`POST /events/:id/checkin`) requires an alumni to have RSVP'd `going` **and** be marked `paid` (`event_rsvps.paid`) before check-in succeeds. Today `paid` always defaults to `false` on RSVP creation and can only become `true` via an admin manually toggling it per alumni per event (`PATCH /events/:id/registrations/:alumniId`). This duplicates work: the alumni already paid a registration fee to have an active account (`users.registration_paid_until`, from the PayMongo signup/renewal flow), and for schools with no separate per-event fee, forcing admins to re-confirm "paid" one row at a time before every event is unnecessary manual work — and it blocked a live scan test today (RSVP'd alumni couldn't check in because nobody had toggled `paid` yet).

## Goal

An alumni whose account is in good standing (registration fee paid and not expired) gets `paid: true` automatically the moment they RSVP `going` to an event — no admin action needed. Admins keep the ability to manually override `paid` per alumni per event (e.g., a school that charges an extra event-specific fee despite having active registration).

## Non-goals

- No per-event fee/price field is being added to the `events` table — out of scope, not requested.
- No change to the check-in gate itself (`events.js:134`, `rsvp.status !== 'going' || !rsvp.paid`) — it keeps reading the `event_rsvps.paid` column as the single source of truth; only how that column gets populated changes.
- No change to `requireAuth`'s existing registration-expiry gate — this design relies on it, doesn't modify it.

## Design

### Key existing fact this design relies on

`requireAuth` (`alumni-backend/src/middleware/auth.js:32-34`) already rejects any request from a user whose `registration_paid_until` is set and in the past, with a 402, before the request reaches route handlers — except for a small allowlist (`/api/me`, `/api/school`, `/api/registration/renew-checkout`). `POST /events/:id/rsvp` is not on that allowlist. So any request that reaches the RSVP handler is guaranteed to come from a user who is either exempt (`registration_paid_until IS NULL`) or currently paid up (`registration_paid_until` in the future). No new expiry check is needed inside the RSVP handler — it can trust `requireAuth` already did it.

### Change 1: `POST /events/:id/rsvp` auto-sets `paid: true` on first RSVP

File: `alumni-backend/src/routes/events.js:57-70`.

Current INSERT:

```js
const rows = await req.db(
  `INSERT INTO event_rsvps (school_id, event_id, user_id, status)
   VALUES ($1,$2,$3,$4)
   ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
   RETURNING *`,
  [req.school.id, req.params.id, req.user.id, status]
);
```

Change to insert `paid` as `true` for new rows only, leaving the `ON CONFLICT` branch untouched (so re-RSVPing / changing status never resets a `paid` value an admin may have manually changed):

```js
const rows = await req.db(
  `INSERT INTO event_rsvps (school_id, event_id, user_id, status, paid)
   VALUES ($1,$2,$3,$4, true)
   ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
   RETURNING *`,
  [req.school.id, req.params.id, req.user.id, status]
);
```

The `PATCH /events/:id/registrations/:alumniId` admin override route (`events.js:84-92`) is unchanged and continues to work exactly as today.

### Change 2: one-off backfill script for existing RSVPs

`alumni-backend/scripts/migrate.js` re-runs the entire `db/schema.sql` on every invocation (it is not a versioned migration system — see `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / idempotent `UPDATE ... WHERE x IS NULL` patterns already in that file). A backfill `UPDATE event_rsvps SET paid = true WHERE paid = false AND ...` embedded there would re-fire on every future `npm run migrate`, silently undoing any admin's future manual "set back to unpaid" action for an alumni whose account happens to be in good standing. That's unacceptable — it would break the override this design explicitly promises to keep.

Instead, add a **standalone, manually-run, one-off script** — not wired into `schema.sql` or `npm run migrate` — following the existing one-off-script convention in this repo (e.g. the pattern used by ad-hoc admin fix scripts under `alumni-backend/scripts/`):

`alumni-backend/scripts/backfill-rsvp-paid.js`:

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

Run once with `node scripts/backfill-rsvp-paid.js` against the target database. It only touches rows currently `paid = false` belonging to users in good standing — it does not touch rows an admin already marked `paid = true`, and (being a manually-invoked script, not part of the routine migration) it never re-fires on its own.

### Data flow (after this change)

```
Alumni RSVPs "going" (first time)
  -> requireAuth already confirmed account is in good standing
  -> INSERT event_rsvps (..., paid=true)

Alumni changes RSVP status later
  -> ON CONFLICT DO UPDATE SET status only -- paid untouched

Admin wants to override paid for one alumni/event
  -> PATCH /events/:id/registrations/:alumniId (unchanged) -- still works

Existing pre-this-change RSVP rows
  -> node scripts/backfill-rsvp-paid.js (run once, manually)
  -> paid=true for rows where paid was false and account is in good standing
```

## Testing

- Backend: extend `alumni-backend/tests/event-registrations.test.js` — a fresh `POST /:id/rsvp` with `status: 'going'` from an active alumni results in `rsvp.paid === true` in the response; a subsequent `PATCH /events/:id/registrations/:alumniId` to `paid: false` followed by the alumni re-RSVPing (status change) leaves `paid` as `false` (proving the `ON CONFLICT` branch doesn't reset it).
- Backend: a small standalone test (or a targeted test in the same file, calling the exported `backfill` function directly against the test DB) verifying: a `paid=false` row for an in-good-standing user becomes `true`; a `paid=false` row for a user with an expired `registration_paid_until` stays `false`; a `paid=true` row is left alone (rowCount excludes it).
- Manual: after deploying Change 1 and running the backfill once, confirm on the live app that a scan/check-in for an already-RSVP'd alumni (from this session's earlier test data) now succeeds without any admin toggling.
