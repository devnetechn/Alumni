# Multi-Tenant Core Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-tenant Alumni backend into a multi-tenant one where every table is scoped to a `school_id`, isolation is enforced by Postgres Row-Level Security (not just application code), and requests are routed to the right school by subdomain — proven by two manually-seeded schools whose data is provably invisible to each other.

**Architecture:** A new `schools` table plus a `school_id` column (and an RLS policy) on every existing table. A tenant-resolution middleware reads the subdomain (or, for authenticated requests, falls back to the JWT's `school_id` claim) and attaches `req.school` + a tenant-scoped `req.db(...)` query function to every request; every route handler swaps its `query(...)` calls for `req.db(...)`. Because Postgres superusers always bypass RLS, the app's runtime connection switches from the existing superuser `postgres` role to a new, unprivileged `alumni_app` role — migrations/seeding keep using the superuser role since they must write across all tenants.

**Tech Stack:** Node/Express, PostgreSQL (`pg`) with Row-Level Security, Jest + Supertest against a real test database.

**Source spec:** `docs/superpowers/specs/2026-08-08-multi-tenant-saas-design.md` — this plan implements only its "core data isolation" pieces (data model, RLS, tenant resolution, auth). Self-serve signup (`POST /api/platform/schools`) and the platform-admin dashboard are separate follow-up plans.

## Global Constraints

- No new database tables beyond `schools`; no billing, branding, or custom-domain work (spec Non-goals).
- Isolation must be enforced at the database level via Row-Level Security, not only in application code (spec Goals).
- Every table gets its own `school_id` column directly, including join/child tables, rather than inheriting tenancy through a parent via joins (spec Architecture — Data model).
- `users.email` uniqueness becomes `UNIQUE(school_id, email)`, not globally unique (spec Architecture — Data model).
- JWTs carry a `school_id` claim; `requireAuth` rejects a token whose `school_id` doesn't match the resolved tenant (spec Architecture — Auth changes).
- No test may leave the suite unable to prove "school A cannot see school B's data" — this is the single most important testing requirement (spec Testing).

---

## File Structure

- `alumni-backend/db/schema.sql` — role creation/grants, new `schools` table, `school_id` on every existing table, RLS policies.
- `alumni-backend/db/seed.js` — seeds two schools instead of one, so isolation can be verified manually.
- `alumni-backend/src/db.js` — gains a second connection pool (`appPool`, connecting as the restricted `alumni_app` role) and a `queryForSchool(schoolId, text, params)` helper.
- `alumni-backend/src/lib/token.js` — JWT payload gains `school_id`.
- `alumni-backend/src/middleware/tenant.js` — **new**. Resolves `req.school` and attaches `req.db`.
- `alumni-backend/src/middleware/auth.js` — `requireAuth` gains a tenant cross-check and uses `req.db` when available.
- `alumni-backend/src/server.js` — mounts the new tenant middleware (after `/api/health`, before every other route).
- `alumni-backend/tests/helpers.js` — gains school fixtures; `insertUser`/`resetDb` become school-aware.
- Every route file under `alumni-backend/src/routes/` — `query(...)` calls become `req.db(...)`.
- `alumni-backend/src/lib/ai.js` — its DB-backed tools become tenant-aware.
- Every existing test file — a mechanical `appPool` cleanup fix, plus targeted fixes wherever a test hits a public route with no JWT (which needs an explicit `Host` header once tenant resolution is global).

---

### Task 1: Restricted Postgres role + dual connection pools

**Files:**
- Modify: `alumni-backend/db/schema.sql` (new content at the very top and very bottom of the file)
- Modify: `alumni-backend/.env.example`
- Modify: `alumni-backend/src/db.js` (full rewrite)
- Test: `alumni-backend/tests/db.test.js` (new)
- Modify (mechanical `afterAll` fix): `alumni-backend/tests/admin.test.js`, `ai.test.js`, `alumni.test.js`, `announcements.test.js`, `auth.test.js`, `event-registrations.test.js`, `events.test.js`, `groups.test.js`, `jobs.test.js`, `me.test.js`, `messages.test.js`, `middleware-auth.test.js`, `notifications.test.js`, `schema.test.js`, `seed.test.js`, `stats.test.js` (16 files, identical pattern) + `socket.test.js` (1 file, distinct pattern)

**Interfaces:**
- Produces: `queryForSchool(schoolId, text, params): Promise<rows[]>`, exported from `src/db.js` alongside the existing `pool`, `appPool`, and `query`. Consumed by the tenant middleware (Task 5) and by `tests/helpers.js` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `alumni-backend/tests/db.test.js`:

```js
const { appPool, queryForSchool } = require('../src/db');

afterAll(() => appPool.end());

test('queryForSchool runs as the restricted alumni_app role, not a superuser', async () => {
  const rows = await queryForSchool(
    1,
    `SELECT current_user AS u, usesuper FROM pg_user WHERE usename = current_user`
  );
  expect(rows[0].u).toBe('alumni_app');
  expect(rows[0].usesuper).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `alumni-backend/`): `npm test -- db.test.js`
Expected: FAIL — `queryForSchool is not a function` (not exported yet), or a connection error since `alumni_app`/`APP_DATABASE_URL` don't exist yet.

- [ ] **Step 3: Add role creation and grants to schema.sql**

In `alumni-backend/db/schema.sql`, insert this at the very top of the file (before the existing `CREATE TABLE IF NOT EXISTS users (...)`):

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alumni_app') THEN
    CREATE ROLE alumni_app LOGIN PASSWORD 'alumni_app_dev';
  END IF;
END
$$;

```

And append this at the very end of the file (after the existing final line, `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;`):

```sql

GRANT ALL ON ALL TABLES IN SCHEMA public TO alumni_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO alumni_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO alumni_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO alumni_app;
```

`migrate.js` re-applies this whole file every run, so every future table (added later in this same file by Task 2) is created before this bottom `GRANT ALL` block runs and is automatically covered by it. The password `alumni_app_dev` is a local-dev-only placeholder — matches this repo's existing convention of committing plaintext local dev credentials (see `postgres`/`123` already in `.env.example`).

- [ ] **Step 4: Add the new env vars**

In `alumni-backend/.env.example`, add after the existing `PORT=4000` line:

```
APP_DATABASE_URL=postgres://alumni_app:alumni_app_dev@localhost:8000/alumni
TEST_APP_DATABASE_URL=postgres://alumni_app:alumni_app_dev@localhost:8000/alumni_test
```

- [ ] **Step 5: Rewrite db.js with dual pools**

Replace the full content of `alumni-backend/src/db.js`:

```js
require('dotenv').config();
const { Pool } = require('pg');

function resolveConnectionString(varName) {
  const value = process.env.NODE_ENV === 'test'
    ? process.env[`TEST_${varName}`]
    : process.env[varName];
  if (!value) {
    throw new Error(
      `Database connection string is not set. Expected ${process.env.NODE_ENV === 'test' ? `TEST_${varName}` : varName} in your .env file.`
    );
  }
  return value;
}

const pool = new Pool({ connectionString: resolveConnectionString('DATABASE_URL') });
const appPool = new Pool({ connectionString: resolveConnectionString('APP_DATABASE_URL') });

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function queryForSchool(schoolId, text, params) {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.school_id', $1, true)`, [String(schoolId)]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, appPool, query, queryForSchool };
```

`pool` (superuser `postgres`) stays used by `scripts/migrate.js` and `db/seed.js`, which must write across all tenants. `appPool` (restricted `alumni_app`) is used only through `queryForSchool`, which sets the RLS session variable via `set_config(..., true)` — `SET LOCAL app.school_id = $1` is **not** used because Postgres's `SET` statement doesn't accept query parameters; `set_config()` is the standard parameterized equivalent, and `true` as the third argument scopes it to the current transaction (`BEGIN...COMMIT`), matching `SET LOCAL` semantics.

- [ ] **Step 6: Create the role locally and run the migration**

Run: `npm run migrate:test` (from `alumni-backend/`) — this both creates the `alumni_app` role (via the `DO $$...$$` block) and grants it privileges, since `migrate:test` connects as the superuser `postgres` via `TEST_DATABASE_URL`.

Then also run: `npm run migrate` (applies the same role/grants against the dev `alumni` database).

- [ ] **Step 7: Run the new test to verify it passes**

Run: `npm test -- db.test.js`
Expected: PASS

- [ ] **Step 8: Fix `afterAll` cleanup in every existing test file that closes `pool`**

`db.js` now creates a second pool (`appPool`) on every module load. Since Jest gives each test file its own fresh module registry, every test file that already does `afterAll(() => pool.end())` now leaks an open `appPool` handle unless it also closes it.

For these 16 files, change the import line `const { pool } = require('../src/db');` (or `const { pool, query } = require('../src/db');`, keeping `query` where already present) to also destructure `appPool`, and change `afterAll(() => pool.end());` to `afterAll(() => Promise.all([pool.end(), appPool.end()]));`:

`alumni-backend/tests/admin.test.js`, `alumni-backend/tests/ai.test.js`, `alumni-backend/tests/alumni.test.js`, `alumni-backend/tests/announcements.test.js`, `alumni-backend/tests/auth.test.js`, `alumni-backend/tests/event-registrations.test.js`, `alumni-backend/tests/events.test.js`, `alumni-backend/tests/groups.test.js`, `alumni-backend/tests/jobs.test.js`, `alumni-backend/tests/me.test.js`, `alumni-backend/tests/messages.test.js`, `alumni-backend/tests/middleware-auth.test.js`, `alumni-backend/tests/notifications.test.js`, `alumni-backend/tests/schema.test.js`, `alumni-backend/tests/seed.test.js`, `alumni-backend/tests/stats.test.js`.

Example (`alumni-backend/tests/admin.test.js`, and identical for the other 15):

```js
// before
const { pool, query } = require('../src/db');
...
afterAll(() => pool.end());

// after
const { pool, appPool, query } = require('../src/db');
...
afterAll(() => Promise.all([pool.end(), appPool.end()]));
```

(files that don't already import `query` — `alumni.test.js`, `event-registrations.test.js`, `events.test.js` has `query` already, `groups.test.js`, `jobs.test.js`, `me.test.js`, `messages.test.js` has `query`, `middleware-auth.test.js` — just add `appPool` next to `pool`, e.g. `const { pool, appPool } = require('../src/db');`)

`alumni-backend/tests/socket.test.js` uses a different `afterAll` shape (line 18-20). Change:

```js
// before
afterAll((done) => {
  pool.end().then(() => server.close(done));
});

// after
afterAll((done) => {
  Promise.all([pool.end(), appPool.end()]).then(() => server.close(done));
});
```

and its import line 4 from `const { pool } = require('../src/db');` to `const { pool, appPool } = require('../src/db');`.

`alumni-backend/tests/health.test.js` needs no change — it never imports from `../src/db`.

- [ ] **Step 9: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: same pass count as before this task (this step only fixes resource cleanup, no behavior changed yet) — no new failures, no hung/open-handle warnings.

- [ ] **Step 10: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/.env.example alumni-backend/src/db.js alumni-backend/tests/db.test.js alumni-backend/tests/admin.test.js alumni-backend/tests/ai.test.js alumni-backend/tests/alumni.test.js alumni-backend/tests/announcements.test.js alumni-backend/tests/auth.test.js alumni-backend/tests/event-registrations.test.js alumni-backend/tests/events.test.js alumni-backend/tests/groups.test.js alumni-backend/tests/jobs.test.js alumni-backend/tests/me.test.js alumni-backend/tests/messages.test.js alumni-backend/tests/middleware-auth.test.js alumni-backend/tests/notifications.test.js alumni-backend/tests/schema.test.js alumni-backend/tests/seed.test.js alumni-backend/tests/socket.test.js alumni-backend/tests/stats.test.js
git commit -m "feat(backend): add restricted alumni_app Postgres role and dual connection pools"
```

---

### Task 2: Schema — `schools` table, `school_id` everywhere, RLS policies

**Files:**
- Modify: `alumni-backend/db/schema.sql`
- Test: `alumni-backend/tests/schema.test.js`

**Interfaces:**
- Produces: a `schools` table (`id, slug, name, active, plan, created_at`); a `school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE` column on `users, events, event_rsvps, event_checkins, jobs, announcements, messages, groups, group_members, group_posts, notifications`; an RLS policy named `tenant_isolation` on each of those 11 tables. Consumed by every later task.

- [ ] **Step 1: Write the failing tests**

Add to `alumni-backend/tests/schema.test.js`:

```js
test('schools table exists with the expected columns', async () => {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'schools'`
  );
  const names = rows.map((r) => r.column_name).sort();
  expect(names).toEqual(['active', 'created_at', 'id', 'name', 'plan', 'slug']);
});

test('every tenant table has a school_id column', async () => {
  const tables = [
    'users', 'events', 'event_rsvps', 'event_checkins', 'jobs',
    'announcements', 'messages', 'groups', 'group_members', 'group_posts', 'notifications',
  ];
  for (const table of tables) {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'school_id'`,
      [table]
    );
    expect(rows.length).toBe(1);
  }
});

test('every tenant table has row-level security enabled', async () => {
  const tables = [
    'users', 'events', 'event_rsvps', 'event_checkins', 'jobs',
    'announcements', 'messages', 'groups', 'group_members', 'group_posts', 'notifications',
  ];
  for (const table of tables) {
    const { rows } = await pool.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = $1`,
      [table]
    );
    expect(rows[0].relrowsecurity).toBe(true);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- schema.test.js`
Expected: FAIL on all three new tests (`schools` table doesn't exist yet; no `school_id` columns; RLS not enabled).

- [ ] **Step 3: Add the schools table, school_id columns, and RLS policies**

In `alumni-backend/db/schema.sql`, insert this new table right after Task 1's role-creation `DO $$...$$` block and before `CREATE TABLE IF NOT EXISTS users (...)`:

```sql
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  plan TEXT NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

```

Change the `users` table definition's `email` line and add `school_id`. Change:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
```

to:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
```

and change its `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` closing line (just before the table's closing `);`) to also add the composite uniqueness constraint:

```sql
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, email)
);
```

For the other 10 tables (`events`, `event_rsvps`, `event_checkins`, `jobs`, `announcements`, `messages`, `groups`, `group_members`, `group_posts`, `notifications`), add `school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,` as the second line of each `CREATE TABLE IF NOT EXISTS <table> (` block (right after `id SERIAL PRIMARY KEY,`, or for `group_members` — which has no `id` column, just a composite primary key — as the very first column). For example, `events` changes from:

```sql
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
```

to:

```sql
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
```

Apply the same one-line insertion to `event_rsvps`, `event_checkins`, `jobs`, `announcements`, `messages`, `groups`, `group_posts`, `notifications` (each already has `id SERIAL PRIMARY KEY,` as its first line). For `group_members` (which has no `id` column), change:

```sql
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
```

to:

```sql
CREATE TABLE IF NOT EXISTS group_members (
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
```

Since `CREATE TABLE IF NOT EXISTS` no-ops on tables that already exist (same lesson as the earlier `is_bot` column), append idempotent `ALTER TABLE` statements so this applies to already-migrated databases too. Insert this block right before Task 1's bottom `GRANT ALL ...` lines (so it runs after all tables exist but the grants still apply to the finished schema):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE event_checkins ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE group_posts ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON events;
CREATE POLICY tenant_isolation ON events
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON event_rsvps;
CREATE POLICY tenant_isolation ON event_rsvps
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON event_checkins;
CREATE POLICY tenant_isolation ON event_checkins
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON jobs;
CREATE POLICY tenant_isolation ON jobs
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON announcements;
CREATE POLICY tenant_isolation ON announcements
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON messages;
CREATE POLICY tenant_isolation ON messages
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON groups;
CREATE POLICY tenant_isolation ON groups
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON group_members;
CREATE POLICY tenant_isolation ON group_members
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON group_posts;
CREATE POLICY tenant_isolation ON group_posts
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

```

`DROP POLICY IF EXISTS` before each `CREATE POLICY` makes re-running migrate idempotent (Postgres has no `CREATE POLICY IF NOT EXISTS`). `schools` itself intentionally gets **no** RLS policy — the tenant-resolution middleware (Task 5) must be able to look up a school's row before any `app.school_id` context exists, which is inherently a pre-tenant operation done via the superuser `pool`/`query()`, not `queryForSchool`.

- [ ] **Step 4: Apply the schema and run the tests**

Run: `npm run migrate:test` then `npm test -- schema.test.js`
Expected: PASS (all 4 tests, including the pre-existing table-list test)

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/tests/schema.test.js
git commit -m "feat(backend): add schools table, school_id columns, and RLS policies"
```

---

### Task 3: Seed — two schools

**Files:**
- Modify: `alumni-backend/db/seed.js`
- Modify: `alumni-backend/tests/seed.test.js`

**Interfaces:**
- Consumes: `schools` table (Task 2).
- Produces: two `schools` rows (`ihes` and a second, minimal `demo-school`) after seeding, so a developer can manually verify isolation between two real subdomains.

- [ ] **Step 1: Write the failing test**

Add to `alumni-backend/tests/seed.test.js`:

```js
test('seed creates two schools, scoping existing fixtures to the first and adding a minimal second', async () => {
  await seed(pool);

  const schools = await query('SELECT * FROM schools ORDER BY id ASC');
  expect(schools.length).toBe(2);
  expect(schools[0].slug).toBe('ihes');
  expect(schools[1].slug).toBe('demo-school');

  const ihesUsers = await query('SELECT * FROM users WHERE school_id = $1', [schools[0].id]);
  expect(ihesUsers.length).toBeGreaterThanOrEqual(6); // admin + 4 alumni + bot

  const demoUsers = await query('SELECT * FROM users WHERE school_id = $1', [schools[1].id]);
  expect(demoUsers.length).toBe(1);
  expect(demoUsers[0].role).toBe('admin');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- seed.test.js`
Expected: FAIL — `schools.length` is `0`, not `2`.

- [ ] **Step 3: Update seed.js**

In `alumni-backend/db/seed.js`, at the very top of the `seed(pool)` function body (before the existing `const adminHash = ...` line), insert:

```js
  const schoolRows = await pool.query(
    `INSERT INTO schools (slug, name) VALUES ('ihes', 'IHES Alumni Association')
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`
  );
  const ihesId = schoolRows.rows[0]
    ? schoolRows.rows[0].id
    : (await pool.query(`SELECT id FROM schools WHERE slug = 'ihes'`)).rows[0].id;

  const demoSchoolHash = await hashPassword('admin123');
  await pool.query(
    `INSERT INTO schools (slug, name) VALUES ('demo-school', 'Demo School') ON CONFLICT (slug) DO NOTHING`
  );
  const demoSchoolId = (await pool.query(`SELECT id FROM schools WHERE slug = 'demo-school'`)).rows[0].id;
  await pool.query(
    `INSERT INTO users (school_id, email, password_hash, role, full_name)
     VALUES ($1, 'admin@demo-school.local', $2, 'admin', 'Demo School Admin')
     ON CONFLICT (school_id, email) DO NOTHING`,
    [demoSchoolId, demoSchoolHash]
  );

```

Then update every existing `INSERT INTO users (...)`, `INSERT INTO events (...)`, `INSERT INTO jobs (...)`, `INSERT INTO announcements (...)` call in the rest of the function to include `school_id` scoped to `ihesId`. Specifically:

Change the admin insert from:

```js
  const adminRows = await pool.query(
    `INSERT INTO users (email, password_hash, role, full_name, batch_year, course)
     VALUES ('admin@alumni.local', $1, 'admin', 'System Admin', 2015, 'BSCS')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [adminHash]
  );
```

to:

```js
  const adminRows = await pool.query(
    `INSERT INTO users (school_id, email, password_hash, role, full_name, batch_year, course)
     VALUES ($1, 'admin@alumni.local', $2, 'admin', 'System Admin', 2015, 'BSCS')
     ON CONFLICT (school_id, email) DO NOTHING
     RETURNING id`,
    [ihesId, adminHash]
  );
```

Change the bot insert (from the earlier AI support bot work) from:

```js
  const botHash = await hashPassword(require('crypto').randomBytes(24).toString('hex'));
  await pool.query(
    `INSERT INTO users (email, password_hash, role, full_name, active, is_bot)
     VALUES ('bot@ihes.local', $1, 'alumni', 'IHES Assistant', true, true)
     ON CONFLICT (email) DO NOTHING`,
    [botHash]
  );
```

to:

```js
  const botHash = await hashPassword(require('crypto').randomBytes(24).toString('hex'));
  await pool.query(
    `INSERT INTO users (school_id, email, password_hash, role, full_name, active, is_bot)
     VALUES ($1, 'bot@ihes.local', $2, 'alumni', 'IHES Assistant', true, true)
     ON CONFLICT (school_id, email) DO NOTHING`,
    [ihesId, botHash]
  );
```

Change the sample-alumni loop's insert from:

```js
    await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader)
       VALUES ($1,$2,'alumni',$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (email) DO NOTHING`,
      [email, sampleHash, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader]
    );
```

to:

```js
    await pool.query(
      `INSERT INTO users (school_id, email, password_hash, role, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader)
       VALUES ($1,$2,$3,'alumni',$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (school_id, email) DO NOTHING`,
      [ihesId, email, sampleHash, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader]
    );
```

Change the `adminId` lookup, events/jobs/announcements existence checks and inserts to be scoped to `ihesId`. Change:

```js
  const adminId = (await pool.query(`SELECT id FROM users WHERE email = 'admin@alumni.local'`)).rows[0].id;

  const existingEvents = await pool.query('SELECT COUNT(*)::int AS c FROM events');
  if (existingEvents.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO events (title, description, location, event_date, created_by) VALUES
       ('Homecoming 2025', 'Annual alumni homecoming', 'Main Gym', now() - interval '2 months', $1),
       ('Batch 2026 Reunion', 'Reconnect with your batch', 'Function Hall', now() + interval '1 month', $1)`,
      [adminId]
    );
  }

  const existingJobs = await pool.query('SELECT COUNT(*)::int AS c FROM jobs');
  if (existingJobs.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO jobs (title, company, location, description, job_type, is_referral, posted_by) VALUES
       ('Frontend Developer', 'Globex Inc', 'Remote', 'React experience needed', 'job', true, $1),
       ('Marketing Intern', 'BuildRight', 'Cebu City', 'Summer internship', 'internship', false, $1)`,
      [adminId]
    );
  }

  const existingAnnouncements = await pool.query('SELECT COUNT(*)::int AS c FROM announcements');
  if (existingAnnouncements.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO announcements (title, body, posted_by) VALUES
       ('Welcome to the new Alumni Portal', 'We are excited to launch this platform for our community.', $1)`,
      [adminId]
    );
  }
```

to:

```js
  const adminId = (await pool.query(`SELECT id FROM users WHERE school_id = $1 AND email = 'admin@alumni.local'`, [ihesId])).rows[0].id;

  const existingEvents = await pool.query('SELECT COUNT(*)::int AS c FROM events WHERE school_id = $1', [ihesId]);
  if (existingEvents.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO events (school_id, title, description, location, event_date, created_by) VALUES
       ($1, 'Homecoming 2025', 'Annual alumni homecoming', 'Main Gym', now() - interval '2 months', $2),
       ($1, 'Batch 2026 Reunion', 'Reconnect with your batch', 'Function Hall', now() + interval '1 month', $2)`,
      [ihesId, adminId]
    );
  }

  const existingJobs = await pool.query('SELECT COUNT(*)::int AS c FROM jobs WHERE school_id = $1', [ihesId]);
  if (existingJobs.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO jobs (school_id, title, company, location, description, job_type, is_referral, posted_by) VALUES
       ($1, 'Frontend Developer', 'Globex Inc', 'Remote', 'React experience needed', 'job', true, $2),
       ($1, 'Marketing Intern', 'BuildRight', 'Cebu City', 'Summer internship', 'internship', false, $2)`,
      [ihesId, adminId]
    );
  }

  const existingAnnouncements = await pool.query('SELECT COUNT(*)::int AS c FROM announcements WHERE school_id = $1', [ihesId]);
  if (existingAnnouncements.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO announcements (school_id, title, body, posted_by) VALUES
       ($1, 'Welcome to the new Alumni Portal', 'We are excited to launch this platform for our community.', $2)`,
      [ihesId, adminId]
    );
  }
```

- [ ] **Step 4: Run the test**

Run: `npm test -- seed.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/db/seed.js alumni-backend/tests/seed.test.js
git commit -m "feat(backend): seed two schools to prove tenant isolation manually"
```

---

### Task 4: JWT gains a `school_id` claim

**Files:**
- Modify: `alumni-backend/src/lib/token.js`
- Test: `alumni-backend/tests/middleware-auth.test.js` is unaffected (still tests `requireAuth`/`requireAdmin` in isolation) — add a focused new test file instead.
- Test: `alumni-backend/tests/token.test.js` (new)

**Interfaces:**
- Produces: `signToken(user)` now embeds `user.school_id` in the JWT payload. Consumed by every route that issues a token (Task 8) and by `tests/helpers.js`'s `authHeader` (Task 7, no code change needed there — it already passes the full user row).

- [ ] **Step 1: Write the failing test**

Create `alumni-backend/tests/token.test.js`:

```js
const { signToken, verifyToken } = require('../src/lib/token');

test('signToken embeds school_id in the payload', () => {
  const token = signToken({ id: 7, role: 'alumni', school_id: 3 });
  const payload = verifyToken(token);
  expect(payload.id).toBe(7);
  expect(payload.role).toBe('alumni');
  expect(payload.school_id).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- token.test.js`
Expected: FAIL — `payload.school_id` is `undefined`.

- [ ] **Step 3: Update token.js**

In `alumni-backend/src/lib/token.js`, change:

```js
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
}
```

to:

```js
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, school_id: user.school_id }, SECRET, { expiresIn: '7d' });
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- token.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/lib/token.js alumni-backend/tests/token.test.js
git commit -m "feat(backend): embed school_id in JWT payload"
```

---

### Task 5: Tenant-resolution middleware + `requireAuth` cross-check

**Files:**
- Create: `alumni-backend/src/middleware/tenant.js`
- Modify: `alumni-backend/src/middleware/auth.js`
- Test: `alumni-backend/tests/tenant.test.js` (new)

**Interfaces:**
- Consumes: `query`, `queryForSchool` from `../db` (Task 1); `verifyToken` from `../lib/token` (Task 4).
- Produces: `resolveTenant(req, res, next)` middleware that sets `req.school = { id, slug, name, active }` and `req.db = (text, params) => queryForSchool(req.school.id, text, params)`, or responds 404. Consumed by `server.js` (Task 6) and by every route handler (Tasks 8-18).

- [ ] **Step 1: Write the failing tests**

Create `alumni-backend/tests/tenant.test.js`:

```js
const express = require('express');
const request = require('supertest');
const { pool, appPool } = require('../src/db');
const { resolveTenant } = require('../src/middleware/tenant');
const { signToken } = require('../src/lib/token');

afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeSchool(slug) {
  const rows = await pool.query(
    `INSERT INTO schools (slug, name) VALUES ($1, $2) RETURNING id, slug`,
    [slug, slug]
  );
  return rows.rows[0];
}

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE schools RESTART IDENTITY CASCADE');
});

function buildApp() {
  const app = express();
  app.use(resolveTenant);
  app.get('/whoami', (req, res) => res.json({ schoolId: req.school.id, slug: req.school.slug }));
  return app;
}

test('resolves the school from a matching subdomain', async () => {
  const school = await makeSchool('ihes-test');
  const app = buildApp();
  const res = await request(app).get('/whoami').set('Host', 'ihes-test.example.com');
  expect(res.status).toBe(200);
  expect(res.body.schoolId).toBe(school.id);
});

test('returns 404 for an unknown subdomain with no fallback token', async () => {
  const app = buildApp();
  const res = await request(app).get('/whoami').set('Host', 'nonexistent.example.com');
  expect(res.status).toBe(404);
});

test('falls back to the JWT school_id when the Host does not resolve', async () => {
  const school = await makeSchool('fallback-test');
  const app = buildApp();
  const token = signToken({ id: 1, role: 'alumni', school_id: school.id });
  const res = await request(app)
    .get('/whoami')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.schoolId).toBe(school.id);
});

test('returns 404 for an inactive school even if the slug matches', async () => {
  const rows = await pool.query(
    `INSERT INTO schools (slug, name, active) VALUES ('inactive-test', 'Inactive', false) RETURNING id`
  );
  const app = buildApp();
  const res = await request(app).get('/whoami').set('Host', 'inactive-test.example.com');
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tenant.test.js`
Expected: FAIL — `Cannot find module '../src/middleware/tenant'`.

- [ ] **Step 3: Implement the middleware**

Create `alumni-backend/src/middleware/tenant.js`:

```js
const { query, queryForSchool } = require('../db');
const { verifyToken } = require('../lib/token');

function subdomainFrom(host) {
  return (host || '').split('.')[0].split(':')[0];
}

async function resolveTenant(req, res, next) {
  try {
    const slug = subdomainFrom(req.headers.host);
    let school = null;

    const bySlug = await query('SELECT id, slug, name, active FROM schools WHERE slug = $1', [slug]);
    if (bySlug.length > 0 && bySlug[0].active) {
      school = bySlug[0];
    }

    if (!school) {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (token) {
        try {
          const payload = verifyToken(token);
          if (payload.school_id) {
            const byId = await query('SELECT id, slug, name, active FROM schools WHERE id = $1', [payload.school_id]);
            if (byId.length > 0 && byId[0].active) {
              school = byId[0];
            }
          }
        } catch {
          // invalid/expired token — leave school unresolved, fall through to 404
        }
      }
    }

    if (!school) {
      return res.status(404).json({ error: 'Unknown school' });
    }

    req.school = school;
    req.db = (text, params) => queryForSchool(school.id, text, params);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { resolveTenant };
```

- [ ] **Step 4: Update `requireAuth` to use `req.db` and cross-check the token's school**

In `alumni-backend/src/middleware/auth.js`, change:

```js
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const rows = await query('SELECT * FROM users WHERE id = $1', [payload.id]);
```

to:

```js
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (req.school && payload.school_id !== req.school.id) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const db = req.db || query;
    const rows = await db('SELECT * FROM users WHERE id = $1', [payload.id]);
```

The `req.school && ...` guard means this cross-check only engages when tenant-resolution middleware actually ran first (true for the real app in production and in every test hitting `src/server.js`'s `app`). `alumni-backend/tests/middleware-auth.test.js` builds its own bare `express()` app with no tenant middleware mounted, so `req.school` stays `undefined` there and this new check is a no-op — that file keeps testing `requireAuth`/`requireAdmin` in isolation exactly as before, no changes needed to it. Using `req.db || query` means the user lookup itself goes through the RLS-restricted path whenever tenant context exists, and only falls back to the unrestricted `query` in that same isolated-test scenario.

- [ ] **Step 5: Run the tests**

Run: `npm test -- tenant.test.js middleware-auth.test.js`
Expected: PASS (all `tenant.test.js` tests; all pre-existing `middleware-auth.test.js` tests unchanged and still passing)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/middleware/tenant.js alumni-backend/src/middleware/auth.js alumni-backend/tests/tenant.test.js
git commit -m "feat(backend): add tenant-resolution middleware and requireAuth cross-check"
```

---

### Task 6: Wire the tenant middleware into server.js

**Files:**
- Modify: `alumni-backend/src/server.js`

**Interfaces:**
- Consumes: `resolveTenant` from `./middleware/tenant` (Task 5).

- [ ] **Step 1: Write the failing test**

This task is pure wiring with no new logic of its own — its correctness is proven by the per-route tests in Tasks 8-18 (which need `req.school`/`req.db` to exist on real requests through `src/server.js`'s `app`) failing until this task lands. As a direct smoke check, add to `alumni-backend/tests/tenant.test.js`:

```js
const { app } = require('../src/server');

test('the real app resolves a school before hitting a route', async () => {
  const school = await makeSchool('server-wiring-test');
  const res = await request(app).get('/api/health').set('Host', 'server-wiring-test.example.com');
  expect(res.status).toBe(200); // health check bypasses tenant resolution entirely
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `npm test -- tenant.test.js`
Expected: PASS already (health check has no tenant dependency yet) — this step just confirms the baseline before moving the route registration order in Step 3.

- [ ] **Step 3: Move the health check before tenant resolution and mount the middleware**

In `alumni-backend/src/server.js`, change:

```js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

to:

```js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const { resolveTenant } = require('./middleware/tenant');
app.use(resolveTenant);

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

and delete the now-duplicate original health route further down:

```js
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Global error-handling middleware
```

becomes just:

```js
// Global error-handling middleware
```

Since Express calls middleware/routes in registration order and the health route fully handles its own response, moving it above `app.use(resolveTenant)` means `/api/health` never reaches (and never needs) tenant resolution — matching the design ("health check stays untouched").

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: many failures now — every route file still calls the old shared `query(...)` instead of `req.db(...)`, so any route relying on tenant-scoped data will 500 or behave incorrectly against the restricted role/RLS. This is expected; Tasks 8-18 fix each route file. Confirm specifically that `tests/health.test.js` and `tests/tenant.test.js` still pass.

Run: `npm test -- health.test.js tenant.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/server.js alumni-backend/tests/tenant.test.js
git commit -m "feat(backend): wire tenant-resolution middleware into the request pipeline"
```

---

### Task 7: `tests/helpers.js` — school-aware fixtures

**Files:**
- Modify: `alumni-backend/tests/helpers.js`

**Interfaces:**
- Produces: `getDefaultSchool(): Promise<{id, slug}>`, `createSchool(overrides?): Promise<{id, slug, name}>`, `hostFor(school): string`, alongside the existing `resetDb`, `insertUser`, `authHeader`. `insertUser(overrides)` now requires (and auto-creates, if omitted) a `school_id`. Consumed by every test file.

- [ ] **Step 1: Write the failing tests**

This is itself test infrastructure, so its "test" is a small dedicated file proving the new exports behave correctly. Create `alumni-backend/tests/helpers.test.js`:

```js
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, createSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('insertUser without an explicit school_id uses a lazily-created default school', async () => {
  const user = await insertUser();
  const school = await getDefaultSchool();
  expect(user.school_id).toBe(school.id);
});

test('insertUser respects an explicit school_id override', async () => {
  const otherSchool = await createSchool();
  const user = await insertUser({ school_id: otherSchool.id });
  expect(user.school_id).toBe(otherSchool.id);
});

test('hostFor formats a school into a subdomain host header value', async () => {
  const school = await createSchool({ slug: 'my-slug' });
  expect(hostFor(school)).toBe('my-slug.example.com');
});

test('resetDb creates a fresh default school after truncating', async () => {
  const first = await getDefaultSchool();
  await resetDb();
  const second = await getDefaultSchool();
  expect(second.id).toBe(first.id); // ids restart at 1 after RESTART IDENTITY
  expect(second.slug).toBe('test-school');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- helpers.test.js`
Expected: FAIL — `getDefaultSchool is not a function` (not exported yet), and `insertUser`'s returned rows have no `school_id` yet.

- [ ] **Step 3: Rewrite tests/helpers.js**

Replace the full content of `alumni-backend/tests/helpers.js`:

```js
const { pool, query } = require('../src/db');
const { hashPassword } = require('../src/lib/password');
const { signToken } = require('../src/lib/token');

let defaultSchool = null;

async function resetDb() {
  defaultSchool = null;
  await pool.query(`
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_checkins, event_rsvps, events, users, schools
    RESTART IDENTITY CASCADE
  `);
}

async function getDefaultSchool() {
  if (defaultSchool) return defaultSchool;
  const rows = await query(
    `INSERT INTO schools (slug, name) VALUES ('test-school', 'Test School') RETURNING id, slug`
  );
  defaultSchool = rows[0];
  return defaultSchool;
}

async function createSchool(overrides = {}) {
  const defaults = {
    slug: `school${Date.now()}${Math.random().toString(16).slice(2)}`,
    name: 'Another School',
  };
  const data = { ...defaults, ...overrides };
  const rows = await query(
    `INSERT INTO schools (slug, name) VALUES ($1,$2) RETURNING id, slug, name`,
    [data.slug, data.name]
  );
  return rows[0];
}

function hostFor(school) {
  return `${school.slug}.example.com`;
}

async function insertUser(overrides = {}) {
  const password_hash = await hashPassword('password123');
  const school_id = overrides.school_id || (await getDefaultSchool()).id;
  const defaults = {
    email: `user${Date.now()}${Math.random().toString(16).slice(2)}@test.com`,
    role: 'alumni',
    active: true,
    is_batch_leader: false,
    full_name: 'Test User',
    batch_year: 2020,
    course: 'BSCS',
  };
  const data = { ...defaults, ...overrides, password_hash, school_id };
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query(
    `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return rows[0];
}

function authHeader(user) {
  return `Bearer ${signToken(user)}`;
}

module.exports = { resetDb, insertUser, authHeader, getDefaultSchool, createSchool, hostFor };
```

`resetDb` truncates `schools` too (cascading through every `school_id` foreign key) and resets `defaultSchool` to `null` first, so the next `getDefaultSchool()` call after a reset creates a fresh row with a predictable, restarted id. `insertUser` is otherwise unchanged in shape — every existing call site across the test suite (`insertUser()`, `insertUser({ role: 'admin' })`, etc.) keeps working unmodified, silently landing in the shared default school unless a test explicitly passes `school_id`.

- [ ] **Step 4: Run the tests**

Run: `npm test -- helpers.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/tests/helpers.js alumni-backend/tests/helpers.test.js
git commit -m "feat(backend): make test fixtures school-aware"
```

---

### Task 8: `auth.js` — school-scoped register/login

**Files:**
- Modify: `alumni-backend/src/routes/auth.js`
- Modify: `alumni-backend/tests/auth.test.js` (full rewrite)

**Interfaces:**
- Consumes: `req.db`, `req.school` (Task 5/6).

- [ ] **Step 1: Rewrite the tests to use a resolvable Host**

Replace the full content of `alumni-backend/tests/auth.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('POST /api/auth/register creates an alumni user and returns a token', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'new@test.com',
      password: 'secret123',
      full_name: 'New Person',
      batch_year: 2021,
      course: 'BSIT',
    });
  expect(res.status).toBe(201);
  expect(res.body.token).toBeTruthy();
  expect(res.body.user.email).toBe('new@test.com');
  expect(res.body.user.role).toBe('alumni');
  expect(res.body.user.password_hash).toBeUndefined();
});

test('POST /api/auth/register rejects a duplicate email within the same school', async () => {
  const school = await getDefaultSchool();
  await insertUser({ email: 'dupe@test.com' });
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'dupe@test.com',
      password: 'secret123',
      full_name: 'Dupe',
    });
  expect(res.status).toBe(409);
});

test('POST /api/auth/login succeeds with correct credentials', async () => {
  const school = await getDefaultSchool();
  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'login@test.com',
      password: 'secret123',
      full_name: 'Login Person',
    });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(school))
    .send({
      email: 'login@test.com',
      password: 'secret123',
    });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
});

test('POST /api/auth/login rejects wrong password', async () => {
  const school = await getDefaultSchool();
  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'login2@test.com',
      password: 'secret123',
      full_name: 'Login Person 2',
    });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(school))
    .send({
      email: 'login2@test.com',
      password: 'wrongpassword',
    });
  expect(res.status).toBe(401);
});

test('POST /api/auth/login rejects a deactivated user even with correct credentials', async () => {
  const school = await getDefaultSchool();
  await insertUser({ email: 'deactivated@test.com', active: false });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(school))
    .send({
      email: 'deactivated@test.com',
      password: 'password123',
    });
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- auth.test.js`
Expected: FAIL — `auth.js` still uses the plain `query()` against `users` with no `school_id` filter, so e.g. the duplicate-email test's `INSERT` will violate the new `UNIQUE(school_id, email)` constraint incorrectly, or return the wrong 409/201 status depending on how the unscoped query behaves under RLS with the restricted role.

- [ ] **Step 3: Update auth.js**

Replace the full content of `alumni-backend/src/routes/auth.js`:

```js
const express = require('express');
const { hashPassword, comparePassword } = require('../lib/password');
const { signToken } = require('../lib/token');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, course, contact, company, position, industry } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const existing = await req.db('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await hashPassword(password);
  const rows = await req.db(
    `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, course, contact, company, position, industry)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.school.id, email, password_hash, full_name || null, batch_year || null, course || null, contact || null, company || null, position || null, industry || null]
  );
  const user = rows[0];
  delete user.password_hash;
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const rows = await req.db('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

  const user = rows[0];
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  if (!user.active) return res.status(403).json({ error: 'Account is deactivated' });

  delete user.password_hash;
  res.json({ token: signToken(user), user });
}));

module.exports = router;
```

`req.db(...)` is already RLS-scoped to `req.school.id`, so the existing `WHERE email = $1` queries (register's duplicate check, login's lookup) are automatically restricted to the resolved school — no explicit `school_id` filter needed in the `WHERE` clause itself, only in the `INSERT`.

- [ ] **Step 4: Run the tests**

Run: `npm test -- auth.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/auth.js alumni-backend/tests/auth.test.js
git commit -m "feat(backend): scope register/login to the resolved school"
```

---

### Task 9: `me.js` + `alumni.js`

**Files:**
- Modify: `alumni-backend/src/routes/me.js`
- Modify: `alumni-backend/src/routes/alumni.js`
- Modify: `alumni-backend/tests/alumni.test.js` (1 line)

**Interfaces:**
- Consumes: `req.db` (Task 5/6).

- [ ] **Step 1: Fix the one unauthenticated test call**

In `alumni-backend/tests/alumni.test.js`, change:

```js
const { resetDb, insertUser, authHeader } = require('./helpers');
```

to:

```js
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');
```

and change:

```js
test('GET /api/alumni requires auth', async () => {
  const res = await request(app).get('/api/alumni');
  expect(res.status).toBe(401);
});
```

to:

```js
test('GET /api/alumni requires auth', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/alumni').set('Host', hostFor(school));
  expect(res.status).toBe(401);
});
```

(without a resolvable `Host`, tenant resolution 404s before `requireAuth` ever runs, which would make this test pass for the wrong reason.)

- [ ] **Step 2: Run test to verify it still passes for the right reason**

Run: `npm test -- alumni.test.js`
Expected: currently PASS by coincidence (both 404 and 401 are non-200) — this step is a checkpoint, not a red/green TDD step; the real verification is Step 4 after the route files are converted, where a genuinely wrong tenant would now surface as 401 (correct) not 404.

- [ ] **Step 3: Convert me.js and alumni.js to req.db**

In `alumni-backend/src/routes/me.js`, remove the `query` import and change every `query(` call to `req.db(`:

```js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const EDITABLE_FIELDS = [
  'full_name', 'batch_year', 'course', 'contact', 'address', 'company',
  'position', 'industry', 'bio', 'profile_pic', 'mentor_available', 'nfc_uid',
];

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [bot] = await req.db('SELECT id, full_name FROM users WHERE is_bot = true LIMIT 1');
  res.json({ me: req.user, bot: bot || null });
}));

router.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.json({ me: req.user });

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);

  const rows = await req.db(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.user.id]
  );
  const me = rows[0];
  delete me.password_hash;
  res.json({ me });
}));

module.exports = router;
```

In `alumni-backend/src/routes/alumni.js`, remove the `query` import and change the one `query(` call to `req.db(`:

```js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/alumni', requireAuth, asyncHandler(async (req, res) => {
  const { search, batch, course, industry, company, location, mentor } = req.query;
  const conditions = ['active = true'];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(full_name ILIKE $${values.length} OR company ILIKE $${values.length} OR position ILIKE $${values.length})`);
  }
  if (batch) {
    values.push(batch);
    conditions.push(`batch_year::text = $${values.length}`);
  }
  if (course) {
    values.push(`%${course}%`);
    conditions.push(`course ILIKE $${values.length}`);
  }
  if (industry) {
    values.push(`%${industry}%`);
    conditions.push(`industry ILIKE $${values.length}`);
  }
  if (company) {
    values.push(`%${company}%`);
    conditions.push(`company ILIKE $${values.length}`);
  }
  if (location) {
    values.push(`%${location}%`);
    conditions.push(`address ILIKE $${values.length}`);
  }
  if (mentor) {
    conditions.push(`mentor_available = true`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await req.db(
    `SELECT id, id AS user_id, email, full_name, batch_year, course, contact, address,
            company, position, industry, bio, profile_pic, mentor_available, nfc_uid, role
     FROM users ${where} ORDER BY full_name NULLS LAST`,
    values
  );
  res.json({ alumni: rows });
}));

module.exports = router;
```

- [ ] **Step 4: Run the affected test files**

Run: `npm test -- alumni.test.js me.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/me.js alumni-backend/src/routes/alumni.js alumni-backend/tests/alumni.test.js
git commit -m "feat(backend): convert me.js and alumni.js to tenant-scoped queries"
```

---

### Task 10: `notifications.js` — convert + `createNotification` signature change

**Files:**
- Modify: `alumni-backend/src/routes/notifications.js`
- Modify: `alumni-backend/tests/notifications.test.js`
- Modify: `alumni-backend/tests/socket.test.js`

**Interfaces:**
- Produces: `createNotification(db, { userId, type, title, body, link })` — the exported function gains a required first parameter, a `req.db`-shaped query function. Consumed by `announcements.js` (Task 11) and `events.js` (Task 12).

- [ ] **Step 1: Update the tests for the new signature**

In `alumni-backend/tests/notifications.test.js`, change every `createNotification({...})` call to `createNotification(req.db equivalent, {...})`. Since these tests call `createNotification` directly (not through an HTTP request), they need their own tenant-scoped db function — add `getDefaultSchool` and build one inline. Replace the full file:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query, queryForSchool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool } = require('./helpers');
const { createNotification } = require('../src/routes/notifications');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function testDb() {
  const school = await getDefaultSchool();
  return (text, params) => queryForSchool(school.id, text, params);
}

test('GET /api/notifications lists notifications and unread count', async () => {
  const user = await insertUser();
  const db = await testDb();
  await createNotification(db, { userId: user.id, type: 'info', title: 'Welcome', body: 'Hi there' });
  await createNotification(db, { userId: user.id, type: 'info', title: 'Second' });

  const res = await request(app).get('/api/notifications').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
  expect(res.body.notifications.length).toBe(2);
  expect(res.body.unread).toBe(2);
});

test('PATCH /api/notifications marks all as read', async () => {
  const user = await insertUser();
  const db = await testDb();
  await createNotification(db, { userId: user.id, type: 'info', title: 'One' });
  await createNotification(db, { userId: user.id, type: 'info', title: 'Two' });

  const patch = await request(app).patch('/api/notifications').set('Authorization', authHeader(user)).send({});
  expect(patch.status).toBe(204);

  const res = await request(app).get('/api/notifications').set('Authorization', authHeader(user));
  expect(res.body.unread).toBe(0);
});

test('createNotification inserts a row scoped to the given user', async () => {
  const user = await insertUser();
  const other = await insertUser();
  const db = await testDb();
  await createNotification(db, { userId: user.id, type: 'info', title: 'Only for user' });

  const rows = await query('SELECT * FROM notifications WHERE user_id = $1', [other.id]);
  expect(rows.length).toBe(0);
});
```

In `alumni-backend/tests/socket.test.js`, change the import line and the one `createNotification(...)` call:

```js
// before
const { createNotification } = require('../src/routes/notifications');
```

stays the same import, but add `queryForSchool` and `getDefaultSchool` to the existing imports — change:

```js
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');
```

to:

```js
const { pool, appPool, queryForSchool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool } = require('./helpers');
```

and change:

```js
afterAll((done) => {
  pool.end().then(() => server.close(done));
});
```

to:

```js
afterAll((done) => {
  Promise.all([pool.end(), appPool.end()]).then(() => server.close(done));
});
```

and change:

```js
  const received = new Promise((resolve) => userSocket.on('notification:new', resolve));
  await createNotification({ userId: user.id, type: 'info', title: 'Ping' });
```

to:

```js
  const received = new Promise((resolve) => userSocket.on('notification:new', resolve));
  const school = await getDefaultSchool();
  const db = (text, params) => queryForSchool(school.id, text, params);
  await createNotification(db, { userId: user.id, type: 'info', title: 'Ping' });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- notifications.test.js socket.test.js`
Expected: FAIL — `createNotification` still only takes one argument, so `db` gets treated as the `{ userId, ... }` object and `type`/`title` end up undefined.

- [ ] **Step 3: Update notifications.js**

Replace the full content of `alumni-backend/src/routes/notifications.js`:

```js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { emitToUser } = require('../lib/socket');

const router = express.Router();

router.get('/notifications', requireAuth, asyncHandler(async (req, res) => {
  const notifications = await req.db(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const unread = notifications.filter((n) => !n.read_at).length;
  res.json({ notifications, unread });
}));

router.patch('/notifications', requireAuth, asyncHandler(async (req, res) => {
  await req.db('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.status(204).end();
}));

async function createNotification(db, { userId, type, title, body, link }) {
  const rows = await db(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, type, title, body || null, link || null]
  );
  const notification = rows[0];
  emitToUser(userId, 'notification:new', notification);
  return notification;
}

module.exports = router;
module.exports.createNotification = createNotification;
```

Note: `INSERT INTO notifications (...)` no longer explicitly lists `school_id` — since `db` is always a `req.db`-shaped function bound to one school (via `queryForSchool`'s `set_config('app.school_id', ...)`), and the RLS policy's `WITH CHECK` clause requires the inserted row's `school_id` to match that setting, an insert with **no** `school_id` column at all would fail the `NOT NULL`... but `school_id` is nullable (`INTEGER REFERENCES schools(id)`, no `NOT NULL` per Task 2's schema) so it would insert `NULL`, which the RLS `WITH CHECK (school_id = current_setting(...)::int)` would then reject (`NULL = anything` is never true) — this INSERT needs `school_id` added explicitly. Change the `createNotification` insert to:

```js
async function createNotification(db, { userId, type, title, body, link }) {
  const rows = await db(
    `INSERT INTO notifications (user_id, type, title, body, link, school_id)
     SELECT $1,$2,$3,$4,$5, school_id FROM users WHERE id = $1
     RETURNING *`,
    [userId, type, title, body || null, link || null]
  );
  const notification = rows[0];
  emitToUser(userId, 'notification:new', notification);
  return notification;
}
```

This derives `school_id` from the recipient user's own row (`SELECT ... FROM users WHERE id = $1`) rather than requiring every caller to pass it explicitly — safe under RLS since that `SELECT` is itself scoped to the same `db`'s resolved school, so it can only ever find `userId` if that user belongs to the calling school in the first place (if `userId` belongs to a different school, the `SELECT` returns zero rows and the whole `INSERT ... SELECT` inserts nothing).

- [ ] **Step 4: Run the tests**

Run: `npm test -- notifications.test.js socket.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/notifications.js alumni-backend/tests/notifications.test.js alumni-backend/tests/socket.test.js
git commit -m "feat(backend): convert notifications.js to tenant-scoped queries"
```

---

### Task 11: `announcements.js`

**Files:**
- Modify: `alumni-backend/src/routes/announcements.js`
- Modify: `alumni-backend/tests/announcements.test.js`

**Interfaces:**
- Consumes: `req.db`, `createNotification(db, {...})` (Task 10).

- [ ] **Step 1: Fix the two unauthenticated test calls**

In `alumni-backend/tests/announcements.test.js`, change:

```js
const { resetDb, insertUser, authHeader } = require('./helpers');
```

to:

```js
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');
```

Change:

```js
test('GET /api/announcements is public', async () => {
  const res = await request(app).get('/api/announcements');
  expect(res.status).toBe(200);
  expect(res.body.announcements).toEqual([]);
});
```

to:

```js
test('GET /api/announcements is public', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/announcements').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.announcements).toEqual([]);
});
```

Change the second unauthenticated call, inside `'admin can create and delete an announcement'`:

```js
  const list = await request(app).get('/api/announcements');
```

to:

```js
  const school = await getDefaultSchool();
  const list = await request(app).get('/api/announcements').set('Host', hostFor(school));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- announcements.test.js`
Expected: FAIL — `announcements.js` still uses plain `query()`, and `createNotification` is called with the old one-argument signature.

- [ ] **Step 3: Update announcements.js**

Replace the full content of `alumni-backend/src/routes/announcements.js`:

```js
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { createNotification } = require('./notifications');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT a.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
            u.role AS poster_role, u.position AS poster_position
     FROM announcements a LEFT JOIN users u ON u.id = a.posted_by
     ORDER BY a.created_at DESC`
  );
  res.json({ announcements: rows });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await req.db(
    `INSERT INTO announcements (school_id, title, body, posted_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, title, body || null, req.user.id]
  );
  const announcement = rows[0];

  const others = await req.db('SELECT id FROM users WHERE id != $1 AND active = true', [req.user.id]);
  for (const u of others) {
    await createNotification(req.db, {
      userId: u.id,
      type: 'announcement',
      title: 'New announcement',
      body: title,
      link: '/announcements',
    });
  }

  res.status(201).json({ announcement });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM announcements WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- announcements.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/announcements.js alumni-backend/tests/announcements.test.js
git commit -m "feat(backend): convert announcements.js to tenant-scoped queries"
```

---

### Task 12: `events.js`

**Files:**
- Modify: `alumni-backend/src/routes/events.js`
- Modify: `alumni-backend/tests/events.test.js`

**Interfaces:**
- Consumes: `req.db`, `createNotification(db, {...})` (Task 10).

- [ ] **Step 1: Fix the one unauthenticated test call**

In `alumni-backend/tests/events.test.js`, change:

```js
const { resetDb, insertUser, authHeader } = require('./helpers');
```

to:

```js
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');
```

and change:

```js
test('GET /api/events is public (no auth required)', async () => {
  const res = await request(app).get('/api/events');
  expect(res.status).toBe(200);
});
```

to:

```js
test('GET /api/events is public (no auth required)', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/events').set('Host', hostFor(school));
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- events.test.js`
Expected: FAIL — same class of failure as Task 11 (unscoped queries, old `createNotification` signature).

- [ ] **Step 3: Update events.js**

Replace the full content of `alumni-backend/src/routes/events.js`:

```js
const express = require('express');
const { requireAuth, requireAdmin, requireOfficer } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { createNotification } = require('./notifications');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const events = await req.db('SELECT * FROM events ORDER BY event_date ASC');
  res.json({ events });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM events WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
  res.json({ event: rows[0] });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description, location, event_date } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: 'title and event_date are required' });
  const rows = await req.db(
    `INSERT INTO events (school_id, title, description, location, event_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.school.id, title, description || null, location || null, event_date, req.user.id]
  );
  const event = rows[0];

  const others = await req.db('SELECT id FROM users WHERE active = true');
  for (const u of others) {
    await createNotification(req.db, {
      userId: u.id,
      type: 'event',
      title: 'New event: ' + title,
      body: description || null,
      link: `/events`,
    });
  }

  res.status(201).json({ event });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

router.get('/:id/rsvp', requireAuth, asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const rows = await req.db('SELECT status, user_id FROM event_rsvps WHERE event_id = $1', [eventId]);
  const counts = { going: 0, maybe: 0, not_going: 0 };
  for (const r of rows) counts[r.status] += 1;
  const mine = rows.find((r) => r.user_id === req.user.id);
  res.json({ counts, myStatus: mine ? mine.status : null });
}));

router.post('/:id/rsvp', requireAuth, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['going', 'maybe', 'not_going'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const rows = await req.db(
    `INSERT INTO event_rsvps (school_id, event_id, user_id, status)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [req.school.id, req.params.id, req.user.id, status]
  );
  res.json({ rsvp: rows[0] });
}));

router.get('/:id/registrations', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT r.id AS rsvp_id, r.user_id AS alumni_id, u.full_name, u.email, u.batch_year,
            r.status, r.paid
     FROM event_rsvps r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1
     ORDER BY u.full_name NULLS LAST`,
    [req.params.id]
  );
  res.json({ registrations: rows });
}));

router.patch('/:id/registrations/:alumniId', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { paid } = req.body;
  const rows = await req.db(
    `UPDATE event_rsvps SET paid = $1 WHERE event_id = $2 AND user_id = $3 RETURNING *`,
    [!!paid, req.params.id, req.params.alumniId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Registration not found' });
  res.json({ registration: rows[0] });
}));

router.get('/:id/checkin', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT c.id, u.full_name, u.batch_year, u.course, c.checked_in_at
     FROM event_checkins c JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at ASC`,
    [req.params.id]
  );
  res.json({ attendance: rows });
}));

function csvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function resolveAlumniFromCode(db, code) {
  const match = /^ALUMNI:(\d+)$/.exec(code || '');
  if (match) {
    const rows = await db('SELECT * FROM users WHERE id = $1', [match[1]]);
    return rows[0] || null;
  }
  const rows = await db('SELECT * FROM users WHERE nfc_uid = $1', [code]);
  return rows[0] || null;
}

router.post('/:id/checkin', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const alumni = await resolveAlumniFromCode(req.db, req.body.code);
  if (!alumni) return res.status(404).json({ error: 'Alumni not found for this code' });

  const rsvpRows = await req.db(
    'SELECT * FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
    [eventId, alumni.id]
  );
  const rsvp = rsvpRows[0];
  if (!rsvp || rsvp.status !== 'going' || !rsvp.paid) {
    return res.status(403).json({ error: 'Alumni must RSVP going and be marked paid before check-in' });
  }

  const rows = await req.db(
    `INSERT INTO event_checkins (school_id, event_id, user_id, checked_in_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (event_id, user_id) DO UPDATE SET checked_in_at = now()
     RETURNING *`,
    [req.school.id, eventId, alumni.id, req.user.id]
  );
  res.status(201).json({ checkin: rows[0] });
}));

router.get('/:id/export', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT u.full_name, u.batch_year, u.course, c.checked_in_at
     FROM event_checkins c JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at ASC`,
    [req.params.id]
  );
  const header = `${csvField('Name')},${csvField('Batch')},${csvField('Course')},${csvField('Checked In At')}\n`;
  const body = rows
    .map((r) => `${csvField(r.full_name)},${csvField(r.batch_year || '')},${csvField(r.course || '')},${csvField(r.checked_in_at.toISOString())}`)
    .join('\n');
  res.set('Content-Type', 'text/csv').send(header + body);
}));

module.exports = router;
```

`resolveAlumniFromCode` now takes `db` as an explicit first parameter (it was previously a bare module-level function calling the shared `query()`), so its one call site (line updated above) passes `req.db`.

- [ ] **Step 4: Run the tests**

Run: `npm test -- events.test.js event-registrations.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/events.js alumni-backend/tests/events.test.js
git commit -m "feat(backend): convert events.js to tenant-scoped queries"
```

---

### Task 13: `groups.js`

**Files:**
- Modify: `alumni-backend/src/routes/groups.js`

**Interfaces:**
- Consumes: `req.db` (Task 5/6). No test file changes needed — every `groups.test.js` call already uses `authHeader`.

- [ ] **Step 1: Run the current test to confirm the starting failure**

Run: `npm test -- groups.test.js`
Expected: FAIL — `groups.js` still uses plain `query()`.

- [ ] **Step 2: Update groups.js**

Replace the full content of `alumni-backend/src/routes/groups.js`:

```js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT g.*,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS member_count,
            EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $1) AS is_member
     FROM groups g
     ORDER BY g.created_at DESC`,
    [req.user.id]
  );
  res.json({ groups: rows });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const groupRows = await req.db('SELECT * FROM groups WHERE id = $1', [req.params.id]);
  if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });

  const members = await req.db(
    `SELECT u.id, u.full_name, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1`,
    [req.params.id]
  );
  const isMember = members.some((m) => m.id === req.user.id);
  res.json({ group: groupRows[0], members, isMember });
}));

router.get('/:id/posts', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT p.*, u.full_name AS author_name, u.email AS author_email
     FROM group_posts p JOIN users u ON u.id = p.author_id
     WHERE p.group_id = $1
     ORDER BY p.created_at ASC`,
    [req.params.id]
  );
  res.json({ posts: rows });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { name, description, kind } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await req.db(
    `INSERT INTO groups (school_id, name, description, kind, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.school.id, name, description || null, kind || 'interest', req.user.id]
  );
  const group = rows[0];
  await req.db(
    `INSERT INTO group_members (school_id, group_id, user_id) VALUES ($1,$2,$3)`,
    [req.school.id, group.id, req.user.id]
  );
  res.status(201).json({ group });
}));

router.post('/:id/join', requireAuth, asyncHandler(async (req, res) => {
  await req.db(
    `INSERT INTO group_members (school_id, group_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [req.school.id, req.params.id, req.user.id]
  );
  res.status(204).end();
}));

router.delete('/:id/join', requireAuth, asyncHandler(async (req, res) => {
  await req.db(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  res.status(204).end();
}));

router.post('/:id/posts', requireAuth, asyncHandler(async (req, res) => {
  const membership = await req.db(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'Must be a group member to post' });

  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });
  const rows = await req.db(
    `INSERT INTO group_posts (school_id, group_id, author_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, req.params.id, req.user.id, body]
  );
  res.status(201).json({ post: rows[0] });
}));

module.exports = router;
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- groups.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add alumni-backend/src/routes/groups.js
git commit -m "feat(backend): convert groups.js to tenant-scoped queries"
```

---

### Task 14: `jobs.js`

**Files:**
- Modify: `alumni-backend/src/routes/jobs.js`
- Modify: `alumni-backend/tests/jobs.test.js`

**Interfaces:**
- Consumes: `req.db` (Task 5/6).

- [ ] **Step 1: Fix the three unauthenticated test calls**

In `alumni-backend/tests/jobs.test.js`, change:

```js
const { resetDb, insertUser, authHeader } = require('./helpers');
```

to:

```js
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');
```

Change:

```js
test('GET /api/jobs is public and includes poster info', async () => {
  const poster = await insertUser({ full_name: 'Poster Person' });
  await request(app)
    .post('/api/jobs')
    .set('Authorization', authHeader(poster))
    .send({ title: 'Backend Dev', company: 'Acme', job_type: 'job' });

  const res = await request(app).get('/api/jobs');
  expect(res.status).toBe(200);
  expect(res.body.jobs[0].poster_name).toBe('Poster Person');
});
```

to:

```js
test('GET /api/jobs is public and includes poster info', async () => {
  const school = await getDefaultSchool();
  const poster = await insertUser({ full_name: 'Poster Person' });
  await request(app)
    .post('/api/jobs')
    .set('Authorization', authHeader(poster))
    .send({ title: 'Backend Dev', company: 'Acme', job_type: 'job' });

  const res = await request(app).get('/api/jobs').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.jobs[0].poster_name).toBe('Poster Person');
});
```

Change:

```js
test('GET /api/jobs?type=internship filters by job_type', async () => {
  const poster = await insertUser();
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Job A', job_type: 'job' });
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Intern A', job_type: 'internship' });

  const res = await request(app).get('/api/jobs').query({ type: 'internship' });
  expect(res.body.jobs.length).toBe(1);
  expect(res.body.jobs[0].title).toBe('Intern A');
});
```

to:

```js
test('GET /api/jobs?type=internship filters by job_type', async () => {
  const school = await getDefaultSchool();
  const poster = await insertUser();
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Job A', job_type: 'job' });
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Intern A', job_type: 'internship' });

  const res = await request(app).get('/api/jobs').query({ type: 'internship' }).set('Host', hostFor(school));
  expect(res.body.jobs.length).toBe(1);
  expect(res.body.jobs[0].title).toBe('Intern A');
});
```

Change:

```js
test('POST /api/jobs requires auth', async () => {
  const res = await request(app).post('/api/jobs').send({ title: 'No Auth Job' });
  expect(res.status).toBe(401);
});
```

to:

```js
test('POST /api/jobs requires auth', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).post('/api/jobs').set('Host', hostFor(school)).send({ title: 'No Auth Job' });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- jobs.test.js`
Expected: FAIL — `jobs.js` still uses plain `query()`.

- [ ] **Step 3: Update jobs.js**

Replace the full content of `alumni-backend/src/routes/jobs.js`:

```js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;
  const conditions = [];
  const values = [];
  if (type) {
    values.push(type);
    conditions.push(`j.job_type = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await req.db(
    `SELECT j.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
            u.role AS poster_role, u.position AS poster_position
     FROM jobs j LEFT JOIN users u ON u.id = j.posted_by
     ${where}
     ORDER BY j.created_at DESC`,
    values
  );
  res.json({ jobs: rows });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { title, company, location, description, job_type, is_referral } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await req.db(
    `INSERT INTO jobs (school_id, title, company, location, description, job_type, is_referral, posted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.school.id, title, company || null, location || null, description || null, job_type || 'job', !!is_referral, req.user.id]
  );
  res.status(201).json({ job: rows[0] });
}));

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Job not found' });
  const job = rows[0];
  if (req.user.role !== 'admin' && req.user.id !== job.posted_by) {
    return res.status(403).json({ error: 'Not allowed to delete this job' });
  }
  await req.db('DELETE FROM jobs WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- jobs.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/jobs.js alumni-backend/tests/jobs.test.js
git commit -m "feat(backend): convert jobs.js to tenant-scoped queries"
```

---

### Task 15: `admin.js`

**Files:**
- Modify: `alumni-backend/src/routes/admin.js`

**Interfaces:**
- Consumes: `req.db` (Task 5/6). No test file changes needed — every `admin.test.js` call already uses `authHeader`.

- [ ] **Step 1: Run the current test to confirm the starting failure**

Run: `npm test -- admin.test.js`
Expected: FAIL — `admin.js` still uses plain `query()`.

- [ ] **Step 2: Update admin.js**

Replace the full content of `alumni-backend/src/routes/admin.js`:

```js
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/users', asyncHandler(async (req, res) => {
  const users = await req.db(
    `SELECT id, email, role, active, is_batch_leader, full_name, batch_year, course, created_at
     FROM users ORDER BY created_at DESC`
  );
  res.json({ users });
}));

router.put('/users/:id', asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ['role', 'active', 'is_batch_leader']) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  const rows = await req.db(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const user = rows[0];
  delete user.password_hash;
  res.json({ user });
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  await req.db('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- admin.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add alumni-backend/src/routes/admin.js
git commit -m "feat(backend): convert admin.js to tenant-scoped queries"
```

---

### Task 16: `messages.js`

**Files:**
- Modify: `alumni-backend/src/routes/messages.js`

**Interfaces:**
- Consumes: `req.db` (Task 5/6). No test file changes needed — every `messages.test.js` call already uses `authHeader`.

- [ ] **Step 1: Run the current test to confirm the starting failure**

Run: `npm test -- messages.test.js`
Expected: FAIL — `messages.js` still uses plain `query()`.

- [ ] **Step 2: Update messages.js**

Replace the full content of `alumni-backend/src/routes/messages.js`:

```js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { emitToUser } = require('../lib/socket');
const { createNotification } = require('./notifications');
const { generateReply } = require('../lib/ai');

const router = express.Router();

async function replyIfBot(db, schoolId, receiverId, senderId, userBody) {
  const [bot] = await db('SELECT id FROM users WHERE is_bot = true LIMIT 1');
  if (!bot || bot.id !== receiverId) return;

  const historyRows = await db(
    `SELECT sender_id, body FROM messages
     WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
     ORDER BY created_at DESC LIMIT 10`,
    [senderId, bot.id]
  );
  const history = historyRows
    .reverse()
    .slice(0, -1)
    .map((m) => ({ role: m.sender_id === bot.id ? 'assistant' : 'user', content: m.body }));

  const reply = await generateReply(history, userBody);

  const [replyMessage] = await db(
    `INSERT INTO messages (school_id, sender_id, receiver_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [schoolId, bot.id, senderId, reply]
  );
  emitToUser(senderId, 'message:new', replyMessage);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await req.db(
      `SELECT
         other.id AS other_id, other.full_name AS other_name, other.email AS other_email,
         (SELECT body FROM messages m2
          WHERE (m2.sender_id = $1 AND m2.receiver_id = other.id) OR (m2.sender_id = other.id AND m2.receiver_id = $1)
          ORDER BY m2.created_at DESC LIMIT 1) AS last_body,
         (SELECT COUNT(*) FROM messages m3 WHERE m3.sender_id = other.id AND m3.receiver_id = $1 AND m3.read_at IS NULL)::int AS unread_count,
         (SELECT MAX(m4.created_at) FROM messages m4
          WHERE (m4.sender_id = $1 AND m4.receiver_id = other.id) OR (m4.sender_id = other.id AND m4.receiver_id = $1)) AS last_at
       FROM users other
       WHERE other.id IN (
         SELECT receiver_id FROM messages WHERE sender_id = $1
         UNION
         SELECT sender_id FROM messages WHERE receiver_id = $1
       )
       ORDER BY last_at DESC`,
      [req.user.id]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    const otherRows = await req.db(
      'SELECT id, full_name, email, batch_year, course FROM users WHERE id = $1',
      [otherId]
    );
    if (otherRows.length === 0) return res.status(404).json({ error: 'User not found' });

    const messages = await req.db(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [req.user.id, otherId]
    );

    await req.db(
      `UPDATE messages SET read_at = now() WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL`,
      [otherId, req.user.id]
    );

    res.json({ messages, other: otherRows[0] });
  } catch (err) {
    console.error('Error fetching thread:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { receiver_id, body } = req.body;
    if (!receiver_id || !body) return res.status(400).json({ error: 'receiver_id and body are required' });
    const rows = await req.db(
      `INSERT INTO messages (school_id, sender_id, receiver_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.school.id, req.user.id, receiver_id, body]
    );
    const message = rows[0];
    emitToUser(receiver_id, 'message:new', message);
    await createNotification(req.db, {
      userId: receiver_id,
      type: 'message',
      title: `New message from ${req.user.full_name || req.user.email}`,
      body: body.length > 100 ? body.slice(0, 100) + '...' : body,
      link: `/messages?to=${req.user.id}`,
    });
    res.status(201).json({ message: message });

    replyIfBot(req.db, req.school.id, receiver_id, req.user.id, body).catch((err) => {
      console.error('Error generating bot reply:', err);
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

`replyIfBot` now takes `db` and `schoolId` as explicit leading parameters instead of closing over the module-level `query` — since `req.db` independently checks out and releases its own client per call (Task 1's `queryForSchool`), calling it again later inside the fire-and-forget `replyIfBot(...).catch(...)` (after the HTTP response has already been sent) is safe: there is no shared per-request connection to have gone stale or been released early.

- [ ] **Step 3: Run the tests**

Run: `npm test -- messages.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add alumni-backend/src/routes/messages.js
git commit -m "feat(backend): convert messages.js to tenant-scoped queries"
```

---

### Task 17: `stats.js`

**Files:**
- Modify: `alumni-backend/src/routes/stats.js`
- Modify: `alumni-backend/tests/stats.test.js`

**Interfaces:**
- Produces: `getCoreCounts(db): Promise<{totalAlumni, totalEvents}>` — gains a required `db` parameter. Consumed by `ai.js` (Task 18).

- [ ] **Step 1: Fix the two unauthenticated test calls and the `getCoreCounts` call**

In `alumni-backend/tests/stats.test.js`, change:

```js
const { resetDb, insertUser, authHeader } = require('./helpers');
const { getCoreCounts } = require('../src/routes/stats');
```

to:

```js
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');
const { getCoreCounts } = require('../src/routes/stats');
const { queryForSchool } = require('../src/db');
```

Change:

```js
  const res = await request(app).get('/api/stats');
  expect(res.status).toBe(200);
  expect(res.body.totalAlumni).toBe(2);
```

(inside `'GET /api/stats returns all expected aggregate shapes'`) — prefix the test body with a school lookup and add the `Host` header:

```js
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
```

(leave the rest of that test's assertions as-is). Similarly for `'GET /api/stats eventsByMonth includes future events, not just past ones'`, change:

```js
  const res = await request(app).get('/api/stats');
  expect(res.status).toBe(200);
  expect(res.body.eventsByMonth.length).toBe(12);
```

to:

```js
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/stats').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.eventsByMonth.length).toBe(12);
```

Change the direct `getCoreCounts()` call:

```js
test('getCoreCounts returns totalAlumni excluding bot accounts, and totalEvents', async () => {
  await insertUser({ batch_year: 2020 });
  await insertUser({ is_bot: true, email: 'bot@ihes.local', full_name: 'IHES Assistant' });
  const counts = await getCoreCounts();
  expect(counts.totalAlumni).toBe(1);
  expect(counts.totalEvents).toBe(0);
});
```

to:

```js
test('getCoreCounts returns totalAlumni excluding bot accounts, and totalEvents', async () => {
  const school = await getDefaultSchool();
  await insertUser({ batch_year: 2020 });
  await insertUser({ is_bot: true, email: 'bot@ihes.local', full_name: 'IHES Assistant' });
  const db = (text, params) => queryForSchool(school.id, text, params);
  const counts = await getCoreCounts(db);
  expect(counts.totalAlumni).toBe(1);
  expect(counts.totalEvents).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stats.test.js`
Expected: FAIL — `stats.js` still uses plain `query()`, and `getCoreCounts` doesn't accept a `db` parameter yet.

- [ ] **Step 3: Update stats.js**

Replace the full content of `alumni-backend/src/routes/stats.js`:

```js
const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

async function monthlyTrend(db, table, dateColumn, monthsBack = 11) {
  const rows = await db(
    `SELECT to_char(date_trunc('month', ${dateColumn} AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${dateColumn} >= now() - interval '${monthsBack + 1} months'
     GROUP BY month_key`
  );
  const byMonth = new Map(rows.map((r) => [r.month_key, r.value]));

  const result = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCMonth(cursor.getUTCMonth() - monthsBack);
  for (let i = 0; i < 12; i++) {
    result.push({ label: monthLabel(cursor), value: byMonth.get(monthKey(cursor)) || 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

async function groupCount(db, table, column, { limit } = {}) {
  const rows = await db(
    `SELECT ${column} AS label, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${column} IS NOT NULL
     GROUP BY ${column}
     ORDER BY value DESC
     ${limit ? `LIMIT ${limit}` : ''}`
  );
  return rows.map((r) => ({ label: String(r.label), value: r.value }));
}

async function getCoreCounts(db) {
  const [totalAlumniRow] = await db('SELECT COUNT(*)::int AS c FROM users WHERE is_bot = false');
  const [totalEventsRow] = await db('SELECT COUNT(*)::int AS c FROM events');
  return { totalAlumni: totalAlumniRow.c, totalEvents: totalEventsRow.c };
}

router.get('/stats', asyncHandler(async (req, res) => {
  const { totalAlumni, totalEvents } = await getCoreCounts(req.db);
  const [totalCheckins] = await req.db('SELECT COUNT(*)::int AS c FROM event_checkins');
  const [totalMessages] = await req.db('SELECT COUNT(*)::int AS c FROM messages');

  const registrationsTrend = await monthlyTrend(req.db, 'users', 'created_at');
  const checkinsTrend = await monthlyTrend(req.db, 'event_checkins', 'checked_in_at');
  const eventsByMonthRaw = await monthlyTrend(req.db, 'events', 'event_date', 5);

  const byBatch = await groupCount(req.db, 'users', 'batch_year');
  const byIndustry = await groupCount(req.db, 'users', 'industry');
  const byCourse = await groupCount(req.db, 'users', 'course');
  const topCompanies = await groupCount(req.db, 'users', 'company', { limit: 8 });

  res.json({
    totalAlumni,
    totalEvents,
    totalCheckins: totalCheckins.c,
    totalMessages: totalMessages.c,
    registrationsTrend,
    checkinsTrend,
    eventsByMonth: eventsByMonthRaw,
    byBatch,
    byIndustry,
    byCourse,
    topCompanies,
  });
}));

module.exports = router;
module.exports.getCoreCounts = getCoreCounts;
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- stats.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/stats.js alumni-backend/tests/stats.test.js
git commit -m "feat(backend): convert stats.js to tenant-scoped queries"
```

---

### Task 18: `ai.js` — tenant-aware tools

**Files:**
- Modify: `alumni-backend/src/lib/ai.js`
- Modify: `alumni-backend/tests/ai.test.js`

**Interfaces:**
- Produces: `generateReply(history, userMessage, db, client?)` — gains a required `db` parameter (inserted before the existing optional `client` parameter). Consumed by `messages.js`'s `replyIfBot` (Task 16 — needs a follow-up one-line change, included below).

- [ ] **Step 1: Update the tests for the new signature**

In `alumni-backend/tests/ai.test.js`, add `queryForSchool` and `getDefaultSchool` imports and thread a `db` through every `generateReply(...)` call. Change:

```js
const { generateReply, FALLBACK_REPLY, NOT_CONFIGURED_REPLY } = require('../src/lib/ai');
const { pool, query } = require('../src/db');
const { resetDb } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('returns the not-configured fallback when no client is available', async () => {
  const reply = await generateReply([], 'Hello', null);
  expect(reply).toBe(NOT_CONFIGURED_REPLY);
});
```

to:

```js
const { generateReply, FALLBACK_REPLY, NOT_CONFIGURED_REPLY } = require('../src/lib/ai');
const { pool, appPool, query, queryForSchool } = require('../src/db');
const { resetDb, getDefaultSchool } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function testDb() {
  const school = await getDefaultSchool();
  return (text, params) => queryForSchool(school.id, text, params);
}

test('returns the not-configured fallback when no client is available', async () => {
  const db = await testDb();
  const reply = await generateReply([], 'Hello', db, null);
  expect(reply).toBe(NOT_CONFIGURED_REPLY);
});
```

Change every remaining `generateReply([], '...', fakeClient)` call (there are 4 more in this file) to `generateReply([], '...', db, fakeClient)`, adding `const db = await testDb();` at the top of each of those test bodies. For example:

```js
test("returns the model's direct text reply when no tool call is requested", async () => {
  const db = await testDb();
  const fakeClient = {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'You can RSVP from the Events page.', tool_calls: undefined } }],
        }),
      },
    },
  };
  const reply = await generateReply([], 'How do I RSVP?', db, fakeClient);
  expect(reply).toBe('You can RSVP from the Events page.');
  expect(fakeClient.chat.completions.create).toHaveBeenCalledTimes(1);
});
```

Apply the same `const db = await testDb();` + updated call signature to the `'executes a requested tool call...'`, `'returns the fallback reply when the OpenAI call throws'`, and `'returns the fallback reply, not a crash, when a tool call fails internally'` tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ai.test.js`
Expected: FAIL — `generateReply` still only takes `(history, userMessage, client)`, so `db` gets passed where `client` is expected and the mocked `chat.completions.create` never gets called correctly.

- [ ] **Step 3: Update ai.js**

Replace the full content of `alumni-backend/src/lib/ai.js`:

```js
require('dotenv').config();
const OpenAI = require('openai');
const { getCoreCounts } = require('../routes/stats');

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!API_KEY) {
  console.warn('OPENAI_API_KEY is not set — the AI support bot will reply with a fixed fallback message.');
}

const defaultClient = API_KEY ? new OpenAI({ apiKey: API_KEY }) : null;

const FALLBACK_REPLY = "Sorry, I'm having trouble answering right now. Please try again in a moment or message an admin directly.";
const NOT_CONFIGURED_REPLY = "The AI assistant isn't configured yet. Please message an admin directly for help.";

const SYSTEM_PROMPT = `You are the IHES Alumni Association assistant, reachable through the Messages page of the alumni portal. You help alumni understand how to use the site (RSVPing to events, browsing jobs, messaging other alumni, updating their profile) and can answer questions about live data using the tools provided. Be concise and friendly.`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_upcoming_events',
      description: 'Get the next 5 upcoming alumni events ordered by date.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_open_jobs',
      description: 'Get the 5 most recently posted job/internship listings.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Get aggregate site stats: total alumni and total events.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

async function get_upcoming_events(db) {
  return db(
    `SELECT title, description, location, event_date FROM events WHERE event_date >= now() ORDER BY event_date ASC LIMIT 5`
  );
}

async function get_open_jobs(db) {
  return db(
    `SELECT title, company, location, job_type, is_referral FROM jobs ORDER BY created_at DESC LIMIT 5`
  );
}

async function get_stats(db) {
  return getCoreCounts(db);
}

const toolImplementations = { get_upcoming_events, get_open_jobs, get_stats };

async function callTool(db, name) {
  const impl = toolImplementations[name];
  if (!impl) return { error: 'unknown tool' };
  try {
    return await impl(db);
  } catch (err) {
    console.error(`ai.js tool "${name}" failed:`, err);
    return { error: `could not run ${name}` };
  }
}

async function generateReply(history, userMessage, db, client = defaultClient) {
  if (!client) return NOT_CONFIGURED_REPLY;

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const first = await client.chat.completions.create({ model: MODEL, messages, tools });
    const choice = first.choices[0].message;

    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      return choice.content || FALLBACK_REPLY;
    }

    const toolMessages = [];
    for (const call of choice.tool_calls) {
      const result = await callTool(db, call.function.name);
      toolMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }

    const second = await client.chat.completions.create({
      model: MODEL,
      messages: [...messages, choice, ...toolMessages],
    });

    return second.choices[0].message.content || FALLBACK_REPLY;
  } catch (err) {
    console.error('ai.js generateReply failed:', err);
    return FALLBACK_REPLY;
  }
}

module.exports = { generateReply, FALLBACK_REPLY, NOT_CONFIGURED_REPLY };
```

In `alumni-backend/src/routes/messages.js` (Task 16), update the one `generateReply(...)` call site to pass `db`. Change:

```js
  const reply = await generateReply(history, userBody);
```

to:

```js
  const reply = await generateReply(history, userBody, db);
```

(inside `replyIfBot`, which already receives `db` as its first parameter per Task 16).

- [ ] **Step 4: Run the tests**

Run: `npm test -- ai.test.js messages.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/lib/ai.js alumni-backend/tests/ai.test.js alumni-backend/src/routes/messages.js
git commit -m "feat(backend): make the AI support bot's tools tenant-aware"
```

---

### Task 19: Cross-tenant isolation test suite

**Files:**
- Create: `alumni-backend/tests/tenant-isolation.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1-18. This is the proof that the whole feature works, not just that individual routes compile.

- [ ] **Step 1: Write the tests**

Create `alumni-backend/tests/tenant-isolation.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, createSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('a user from school A cannot see school B\'s alumni directory', async () => {
  const schoolA = await createSchool({ slug: 'school-a' });
  const schoolB = await createSchool({ slug: 'school-b' });
  const userA = await insertUser({ school_id: schoolA.id, full_name: 'Alice A' });
  await insertUser({ school_id: schoolB.id, full_name: 'Bob B' });

  const res = await request(app).get('/api/alumni').set('Authorization', authHeader(userA));
  expect(res.status).toBe(200);
  expect(res.body.alumni.some((a) => a.full_name === 'Alice A')).toBe(true);
  expect(res.body.alumni.some((a) => a.full_name === 'Bob B')).toBe(false);
});

test('a school-A token cannot fetch a school-A-shaped event that actually belongs to school B', async () => {
  const schoolA = await createSchool({ slug: 'school-a-events' });
  const schoolB = await createSchool({ slug: 'school-b-events' });
  const adminA = await insertUser({ school_id: schoolA.id, role: 'admin' });
  const adminB = await insertUser({ school_id: schoolB.id, role: 'admin' });

  const createB = await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(adminB))
    .send({ title: 'School B Only Event', event_date: '2026-12-01T18:00:00Z' });
  const eventBId = createB.body.event.id;

  const res = await request(app)
    .get(`/api/events/${eventBId}`)
    .set('Authorization', authHeader(adminA));
  expect(res.status).toBe(404);
});

test('logging in with the same email on two different schools resolves two different accounts', async () => {
  const schoolA = await createSchool({ slug: 'dup-email-a' });
  const schoolB = await createSchool({ slug: 'dup-email-b' });

  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(schoolA))
    .send({ email: 'shared@test.com', password: 'passwordA', full_name: 'Person At A' });
  await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(schoolB))
    .send({ email: 'shared@test.com', password: 'passwordB', full_name: 'Person At B' });

  const loginA = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(schoolA))
    .send({ email: 'shared@test.com', password: 'passwordA' });
  expect(loginA.status).toBe(200);
  expect(loginA.body.user.full_name).toBe('Person At A');

  const loginB = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(schoolB))
    .send({ email: 'shared@test.com', password: 'passwordB' });
  expect(loginB.status).toBe(200);
  expect(loginB.body.user.full_name).toBe('Person At B');

  const crossLogin = await request(app)
    .post('/api/auth/login')
    .set('Host', hostFor(schoolA))
    .send({ email: 'shared@test.com', password: 'passwordB' });
  expect(crossLogin.status).toBe(401);
});

test('a message sent between two school-A users is invisible to a school-B admin querying directly', async () => {
  const schoolA = await createSchool({ slug: 'msg-school-a' });
  const schoolB = await createSchool({ slug: 'msg-school-b' });
  const userA1 = await insertUser({ school_id: schoolA.id });
  const userA2 = await insertUser({ school_id: schoolA.id });
  const adminB = await insertUser({ school_id: schoolB.id, role: 'admin' });

  await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(userA1))
    .send({ receiver_id: userA2.id, body: 'Secret to school A' });

  const res = await request(app).get('/api/messages').set('Authorization', authHeader(adminB));
  expect(res.status).toBe(200);
  expect(res.body.conversations.length).toBe(0);
});

test('a token minted for school A is rejected outright on school B\'s subdomain', async () => {
  const schoolA = await createSchool({ slug: 'token-school-a' });
  const schoolB = await createSchool({ slug: 'token-school-b' });
  const userA = await insertUser({ school_id: schoolA.id });

  const res = await request(app)
    .get('/api/alumni')
    .set('Authorization', authHeader(userA))
    .set('Host', hostFor(schoolB));
  expect(res.status).toBe(401);
});
```

The last test is the one genuinely adversarial case where the JWT-fallback design (Task 5) doesn't apply: an explicit `Host` pointing at school B combined with a token minted for school A must be rejected by the `requireAuth` cross-check, not silently resolved via the JWT fallback (the fallback only ever engages when the *Host itself* fails to resolve, never to override a Host that *did* resolve).

- [ ] **Step 2: Run the tests**

Run: `npm test -- tenant-isolation.test.js`
Expected: PASS (all 5 tests) — if any fails, that's a genuine cross-tenant data leak; do not proceed to Task 20 until every test here passes.

- [ ] **Step 3: Commit**

```bash
git add alumni-backend/tests/tenant-isolation.test.js
git commit -m "test(backend): add cross-tenant isolation test suite"
```

---

### Task 20: Documentation + full suite verification

**Files:**
- Modify: `alumni-backend/README.md`

**Interfaces:** None — this is the final verification and documentation pass.

- [ ] **Step 1: Update README.md**

In `alumni-backend/README.md`, add a new section after "AI support bot":

```markdown

## Multi-tenancy

Every alumni, event, job, etc. belongs to a school (`schools` table), resolved per-request from
the subdomain (e.g. `ihes.yourapp.com`). Row-Level Security enforces isolation at the database
level — the app's runtime connection uses a restricted `alumni_app` Postgres role (not the
`postgres` superuser used for migrations/seeding), since superusers always bypass RLS. This role
is created automatically the first time `npm run migrate` / `npm run migrate:test` runs, using
the placeholder password in `.env.example`'s `APP_DATABASE_URL`/`TEST_APP_DATABASE_URL` — change
it before deploying anywhere but local dev.

`npm run seed` creates two schools (`ihes`, the original fixture data, and a minimal `demo-school`)
so isolation can be checked manually: log into `ihes.localhost:5173` and `demo-school.localhost:5173`
(both resolve to `127.0.0.1` automatically in modern browsers, no `/etc/hosts` editing needed) and
confirm neither sees the other's alumni, events, or messages.

There is no self-serve signup yet — new schools are inserted directly into the `schools` table.
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: every test suite passes — this is the final confirmation that all 20 tasks compose correctly together, not just individually.

- [ ] **Step 3: Commit**

```bash
git add alumni-backend/README.md
git commit -m "docs(backend): document multi-tenant setup and manual verification steps"
```

---

## Self-Review Notes

- **Spec coverage:** data model + `schools` table (Task 2), RLS (Task 2), the restricted-role requirement uncovered during planning — not explicit in the spec but necessary for the spec's own goal ("enforced at the database level") to actually hold given `postgres` is a superuser locally (Task 1), tenant-resolution middleware + JWT fallback (Task 5), server wiring (Task 6), auth changes (Task 4, 8), every route file (Tasks 9-18), cross-tenant test suite (Task 19, directly implementing the spec's Testing section) — every spec section for this phase has a task.
- **Deferred (per spec Non-goals and this plan's own scope note):** `POST /api/platform/schools` self-serve signup, the platform-admin `BYPASSRLS` role and dashboard, billing, branding, custom domains — separate follow-up plans, not gaps in this one.
- **Type/signature consistency:** `req.db(text, params)` (Task 5) is the exact same two-argument shape as the original `query(text, params)` everywhere it replaces it (Tasks 8-17), so no route's calling convention needed restructuring beyond the substitution itself. `createNotification(db, {...})` (Task 10) is consistently called with `req.db` from `announcements.js`/`events.js`/`messages.js` (Tasks 11, 12, 16) and with a manually-built `db` in tests that call it directly outside an HTTP request (Task 10's own test updates). `generateReply(history, userMessage, db, client)` (Task 18) is called with `(history, userBody, db)` from `messages.js`'s `replyIfBot` (Task 16/18) and with explicit `(., ., db, fakeClient)` in tests. `getCoreCounts(db)` (Task 17) is called with `req.db` from the `/stats` route and with `db` from `ai.js`'s `get_stats` tool (Task 18).
- **No placeholders:** every step contains literal, complete code — no "add appropriate scoping" or "update the test" without showing the exact diff.
