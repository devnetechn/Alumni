# Platform (Master) Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bootstrap-only-signup master admin account can log in at `/platform/login`, see every school with alumni/event counts, and activate/deactivate, mark-active, extend-trial, or delete any school — all through one auditable, `BYPASSRLS`-but-otherwise-minimal Postgres role that no school-scoped request handling ever touches.

**Architecture:** A `platform_admins` table and a dedicated `alumni_platform` Postgres role (own connection pool, own query helper `platformQuery`), completely parallel to the existing `alumni_app` tenant role — never shared, never crossed. Platform-admin JWTs carry `type: 'platform_admin'` (no `school_id`), verified by a new `requirePlatformAdmin` middleware structurally incompatible with the existing `requireAuth`. New routes live under `/api/platform/admin/*`, registered before `resolveTenant` (same placement as the existing school-signup endpoint) since platform admin isn't tied to any subdomain. The frontend gets three new pages in their own branch of `App.jsx` that bypasses the normal school-tenant `Shell` entirely, and a separate `platformApi` axios instance with its own token key (`platform_token`) so a browser can hold a school session and a platform session at once without collision.

**Tech Stack:** Same as the rest of the app — Express, `pg`, Jest + Supertest, React 19, axios.

## Global Constraints

- Every platform-admin database query goes through `platformQuery` (the `alumni_platform`/`BYPASSRLS` pool) — never `query()` or `req.db(...)`. This is the entire safety property of the feature; don't blur it for convenience.
- `POST /api/platform/admin/signup` must be impossible to use a second time once one `platform_admins` row exists — checked server-side on every request, not just hidden client-side.
- `DELETE /api/platform/admin/schools/:id` must require `{ confirmSlug }` in the body matching the school's actual slug, in addition to the auth token.
- Platform-admin frontend pages never import or rely on `useAuth()` (the school-tenant context) — they manage their own `platform_token` directly.

---

## Task 1: Schema, role, and connection pool

**Files:**
- Modify: `alumni-backend/db/schema.sql`
- Modify: `alumni-backend/src/db.js`
- Modify: `alumni-backend/.env.example`
- Modify: `alumni-backend/.env` (not committed — local dev only)

**Interfaces:**
- Produces: `platformPool` (pg `Pool` on the `alumni_platform` role), `platformQuery(text, params)` — both exported from `alumni-backend/src/db.js`, alongside the existing `pool`, `appPool`, `query`, `queryForSchool`.

- [ ] **Step 1: Append the new table, role, and grants to `schema.sql`**

Add at the end of `alumni-backend/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS platform_admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alumni_platform') THEN
    CREATE ROLE alumni_platform LOGIN PASSWORD 'alumni_platform_dev' BYPASSRLS;
  END IF;
END
$$;

GRANT SELECT, UPDATE, DELETE ON schools TO alumni_platform;
GRANT SELECT ON users, events, event_rsvps, event_checkins, jobs, announcements, messages, groups, group_members, group_posts, notifications TO alumni_platform;
GRANT ALL ON platform_admins TO alumni_platform;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO alumni_platform;
```

- [ ] **Step 2: Add `platformPool`/`platformQuery` to `db.js`**

In `alumni-backend/src/db.js`, replace:

```js
const pool = new Pool({ connectionString: resolveConnectionString('DATABASE_URL') });
const appPool = new Pool({ connectionString: resolveConnectionString('APP_DATABASE_URL') });

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}
```

with:

```js
const pool = new Pool({ connectionString: resolveConnectionString('DATABASE_URL') });
const appPool = new Pool({ connectionString: resolveConnectionString('APP_DATABASE_URL') });
const platformPool = new Pool({ connectionString: resolveConnectionString('PLATFORM_DATABASE_URL') });

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function platformQuery(text, params) {
  const result = await platformPool.query(text, params);
  return result.rows;
}
```

And change the final export line from:
```js
module.exports = { pool, appPool, query, queryForSchool };
```
to:
```js
module.exports = { pool, appPool, platformPool, query, queryForSchool, platformQuery };
```

- [ ] **Step 3: Add the new env vars**

Append to `alumni-backend/.env.example`:
```
PLATFORM_DATABASE_URL=postgres://alumni_platform:alumni_platform_dev@localhost:8000/alumni
TEST_PLATFORM_DATABASE_URL=postgres://alumni_platform:alumni_platform_dev@localhost:8000/alumni_test
```

Append the same two lines (same values — local dev password) to `alumni-backend/.env`, which is gitignored and not part of this commit.

- [ ] **Step 4: Apply and verify**

```bash
cd alumni-backend
node scripts/migrate.js
NODE_ENV=test node scripts/migrate.js
NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand
```

Expected: all existing tests still pass — this step only adds a new table/role, nothing existing changes behavior yet.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/src/db.js alumni-backend/.env.example
git commit -m "feat(backend): add platform_admins table and alumni_platform BYPASSRLS role"
```

---

## Task 2: Platform-admin token and auth middleware

**Files:**
- Modify: `alumni-backend/src/lib/token.js`
- Create: `alumni-backend/src/middleware/platformAuth.js`
- Test: `alumni-backend/tests/platformAuth.test.js` (new)

**Interfaces:**
- Produces: `signPlatformToken(admin)` (in `lib/token.js`, alongside existing `signToken`/`verifyToken`) — signs `{ type: 'platform_admin', id: admin.id }`. `requirePlatformAdmin` middleware — sets `req.platformAdmin = { id, email }` on success.

- [ ] **Step 1: Add `signPlatformToken` to `token.js`**

In `alumni-backend/src/lib/token.js`, replace:

```js
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, school_id: user.school_id }, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
```

with:

```js
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, school_id: user.school_id }, SECRET, { expiresIn: '7d' });
}

function signPlatformToken(admin) {
  return jwt.sign({ type: 'platform_admin', id: admin.id }, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, signPlatformToken, verifyToken };
```

- [ ] **Step 2: Create `alumni-backend/src/middleware/platformAuth.js`**

```js
const { verifyToken } = require('../lib/token');
const { platformQuery } = require('../db');
const { asyncHandler } = require('../lib/asyncHandler');

const requirePlatformAdmin = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (payload.type !== 'platform_admin') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const rows = await platformQuery('SELECT id, email FROM platform_admins WHERE id = $1', [payload.id]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid or expired token' });

  req.platformAdmin = rows[0];
  next();
});

module.exports = { requirePlatformAdmin };
```

- [ ] **Step 3: Write the failing tests**

Create `alumni-backend/tests/platformAuth.test.js`:

```js
const express = require('express');
const request = require('supertest');
const { pool, platformPool, query } = require('../src/db');
const { signToken, signPlatformToken } = require('../src/lib/token');
const { requirePlatformAdmin } = require('../src/middleware/platformAuth');
const { resetDb, insertUser } = require('./helpers');

afterAll(() => Promise.all([pool.end(), platformPool.end()]));

const app = express();
app.get('/protected', requirePlatformAdmin, (req, res) => res.json({ ok: true, admin: req.platformAdmin }));

async function insertPlatformAdmin(overrides = {}) {
  const rows = await query(
    `INSERT INTO platform_admins (email, password_hash) VALUES ($1, 'x') RETURNING id, email`,
    [overrides.email || `admin${Date.now()}@platform.test`]
  );
  return rows[0];
}

describe('requirePlatformAdmin', () => {
  beforeEach(resetDb);

  test('rejects a missing token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  test('rejects an invalid token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  test('rejects a well-formed school-user token (no type claim)', async () => {
    const user = await insertUser();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${signToken(user)}`);
    expect(res.status).toBe(401);
  });

  test('rejects a platform-admin token whose id no longer exists', async () => {
    const admin = await insertPlatformAdmin();
    const token = signPlatformToken(admin);
    await query('DELETE FROM platform_admins WHERE id = $1', [admin.id]);
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('accepts a valid platform-admin token', async () => {
    const admin = await insertPlatformAdmin();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${signPlatformToken(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe(admin.email);
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd alumni-backend
NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand platformAuth.test.js
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/lib/token.js alumni-backend/src/middleware/platformAuth.js alumni-backend/tests/platformAuth.test.js
git commit -m "feat(backend): add platform-admin token signing and auth middleware"
```

---

## Task 3: Platform-admin routes

**Files:**
- Create: `alumni-backend/src/routes/platformAdmin.js`
- Modify: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/platformAdmin.test.js` (new)

**Interfaces:**
- Produces: `POST /api/platform/admin/signup`, `POST /api/platform/admin/login`, `GET /api/platform/admin/schools`, `PATCH /api/platform/admin/schools/:id`, `DELETE /api/platform/admin/schools/:id`.

- [ ] **Step 1: Create `alumni-backend/src/routes/platformAdmin.js`**

```js
const express = require('express');
const { platformQuery } = require('../db');
const { hashPassword, comparePassword } = require('../lib/password');
const { signPlatformToken } = require('../lib/token');
const { asyncHandler } = require('../lib/asyncHandler');
const { requirePlatformAdmin } = require('../middleware/platformAuth');

const router = express.Router();

router.post('/signup', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const existing = await platformQuery('SELECT id FROM platform_admins');
  if (existing.length > 0) {
    return res.status(403).json({ error: 'Platform admin already set up' });
  }

  const password_hash = await hashPassword(password);
  const rows = await platformQuery(
    'INSERT INTO platform_admins (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, password_hash]
  );
  const admin = rows[0];
  res.status(201).json({ token: signPlatformToken(admin) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const rows = await platformQuery('SELECT * FROM platform_admins WHERE email = $1', [email]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

  const admin = rows[0];
  const ok = await comparePassword(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ token: signPlatformToken(admin) });
}));

router.get('/schools', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const schools = await platformQuery(`
    SELECT s.id, s.slug, s.name, s.active, s.plan, s.trial_ends_at, s.created_at,
      (SELECT COUNT(*)::int FROM users u WHERE u.school_id = s.id AND u.is_bot = false) AS alumni_count,
      (SELECT COUNT(*)::int FROM events e WHERE e.school_id = s.id) AS event_count
    FROM schools s ORDER BY s.created_at DESC
  `);
  res.json({ schools });
}));

router.patch('/schools/:id', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { active, plan, extendTrialDays } = req.body;

  if (typeof active === 'boolean') {
    await platformQuery('UPDATE schools SET active = $1 WHERE id = $2', [active, id]);
  } else if (plan === 'active') {
    await platformQuery(`UPDATE schools SET plan = 'active' WHERE id = $1`, [id]);
  } else if (typeof extendTrialDays === 'number') {
    await platformQuery(
      `UPDATE schools SET trial_ends_at = GREATEST(trial_ends_at, now()) + ($1 || ' days')::interval WHERE id = $2`,
      [extendTrialDays, id]
    );
  } else {
    return res.status(400).json({ error: 'Provide active, plan, or extendTrialDays' });
  }

  const rows = await platformQuery(
    'SELECT id, slug, name, active, plan, trial_ends_at FROM schools WHERE id = $1',
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'School not found' });
  res.json({ school: rows[0] });
}));

router.delete('/schools/:id', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { confirmSlug } = req.body;

  const rows = await platformQuery('SELECT slug FROM schools WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'School not found' });

  if (rows[0].slug !== confirmSlug) {
    return res.status(400).json({ error: 'Slug confirmation does not match' });
  }

  await platformQuery('DELETE FROM schools WHERE id = $1', [id]);
  res.status(204).end();
}));

module.exports = router;
```

- [ ] **Step 2: Register the routes in `server.js`, before `resolveTenant`**

In `alumni-backend/src/server.js`, replace:

```js
const platformRoutes = require('./routes/platform');
app.use('/api/platform', platformRoutes);

const { resolveTenant } = require('./middleware/tenant');
app.use(resolveTenant);
```

with:

```js
const platformRoutes = require('./routes/platform');
app.use('/api/platform', platformRoutes);

const platformAdminRoutes = require('./routes/platformAdmin');
app.use('/api/platform/admin', platformAdminRoutes);

const { resolveTenant } = require('./middleware/tenant');
app.use(resolveTenant);
```

- [ ] **Step 3: Write the failing tests**

Create `alumni-backend/tests/platformAdmin.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, platformPool, query } = require('../src/db');
const { resetDb, createSchool, insertUser } = require('./helpers');

afterAll(() => Promise.all([pool.end(), platformPool.end()]));

async function bootstrap() {
  const res = await request(app).post('/api/platform/admin/signup').send({
    email: 'master@platform.test',
    password: 'password123',
  });
  return res.body.token;
}

describe('platform admin bootstrap', () => {
  beforeEach(resetDb);

  test('first signup succeeds and creates exactly one row', async () => {
    const res = await request(app).post('/api/platform/admin/signup').send({
      email: 'master@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    const rows = await query('SELECT * FROM platform_admins');
    expect(rows).toHaveLength(1);
  });

  test('a second signup attempt is rejected once one exists', async () => {
    await bootstrap();
    const res = await request(app).post('/api/platform/admin/signup').send({
      email: 'second@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(403);
    const rows = await query('SELECT * FROM platform_admins');
    expect(rows).toHaveLength(1);
  });

  test('signup works again after the existing admin is removed (fresh install)', async () => {
    await bootstrap();
    await query('DELETE FROM platform_admins');
    const res = await request(app).post('/api/platform/admin/signup').send({
      email: 'again@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(201);
  });
});

describe('platform admin login', () => {
  beforeEach(resetDb);

  test('wrong password is rejected', async () => {
    await bootstrap();
    const res = await request(app).post('/api/platform/admin/login').send({
      email: 'master@platform.test',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  test('correct credentials return a token', async () => {
    await bootstrap();
    const res = await request(app).post('/api/platform/admin/login').send({
      email: 'master@platform.test',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('GET /api/platform/admin/schools', () => {
  beforeEach(resetDb);

  test('returns every school with correct alumni/event counts, across schools', async () => {
    const token = await bootstrap();
    const schoolA = await createSchool({ name: 'School A' });
    const schoolB = await createSchool({ name: 'School B' });
    await insertUser({ school_id: schoolA.id });
    await insertUser({ school_id: schoolA.id });
    await insertUser({ school_id: schoolB.id });
    await query(
      `INSERT INTO events (school_id, title, event_date) VALUES ($1, 'Event A', now())`,
      [schoolA.id]
    );

    const res = await request(app)
      .get('/api/platform/admin/schools')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const a = res.body.schools.find((s) => s.slug === schoolA.slug);
    const b = res.body.schools.find((s) => s.slug === schoolB.slug);
    expect(a.alumni_count).toBe(2);
    expect(a.event_count).toBe(1);
    expect(b.alumni_count).toBe(1);
    expect(b.event_count).toBe(0);
  });

  test('rejects a request with no platform-admin token', async () => {
    const res = await request(app).get('/api/platform/admin/schools');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/platform/admin/schools/:id', () => {
  beforeEach(resetDb);

  test('active updates only the targeted school', async () => {
    const token = await bootstrap();
    const schoolA = await createSchool();
    const schoolB = await createSchool();

    const res = await request(app)
      .patch(`/api/platform/admin/schools/${schoolA.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.school.active).toBe(false);
    const untouchedRows = await query('SELECT active FROM schools WHERE id = $1', [schoolB.id]);
    expect(untouchedRows[0].active).toBe(true);
  });

  test('plan active sets the plan column', async () => {
    const token = await bootstrap();
    const school = await createSchool();
    const res = await request(app)
      .patch(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'active' });
    expect(res.body.school.plan).toBe('active');
  });

  test('extendTrialDays pushes trial_ends_at forward', async () => {
    const token = await bootstrap();
    const school = await createSchool();
    const before = await query('SELECT trial_ends_at FROM schools WHERE id = $1', [school.id]);

    const res = await request(app)
      .patch(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ extendTrialDays: 30 });

    expect(new Date(res.body.school.trial_ends_at).getTime()).toBeGreaterThan(new Date(before[0].trial_ends_at).getTime());
  });
});

describe('DELETE /api/platform/admin/schools/:id', () => {
  beforeEach(resetDb);

  test('correct confirmSlug deletes the school and its data', async () => {
    const token = await bootstrap();
    const school = await createSchool();
    await insertUser({ school_id: school.id });

    const res = await request(app)
      .delete(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmSlug: school.slug });

    expect(res.status).toBe(204);
    const schoolRows = await query('SELECT * FROM schools WHERE id = $1', [school.id]);
    expect(schoolRows).toHaveLength(0);
    const userRows = await query('SELECT * FROM users WHERE school_id = $1', [school.id]);
    expect(userRows).toHaveLength(0);
  });

  test('mismatched confirmSlug leaves the school untouched', async () => {
    const token = await bootstrap();
    const school = await createSchool();

    const res = await request(app)
      .delete(`/api/platform/admin/schools/${school.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmSlug: 'wrong-slug' });

    expect(res.status).toBe(400);
    const schoolRows = await query('SELECT * FROM schools WHERE id = $1', [school.id]);
    expect(schoolRows).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd alumni-backend
NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand platformAdmin.test.js
```

Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/platformAdmin.js alumni-backend/src/server.js alumni-backend/tests/platformAdmin.test.js
git commit -m "feat(backend): add platform-admin school management routes"
```

---

## Task 4: Full backend regression pass

**Files:**
- None (verification-only task).

- [ ] **Step 1: Run the complete backend test suite**

```bash
cd alumni-backend
NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand
```

Expected: every test file passes, including the three new ones from Tasks 1–3, alongside every pre-existing test.

- [ ] **Step 2: No commit needed** — this task is verification-only.

---

## Task 5: Frontend — `platformApi` axios instance

**Files:**
- Modify: `alumni-frontend/src/api.js`

**Interfaces:**
- Produces: `platformApi` — a second axios instance (`baseURL: '/api/platform/admin'`) with its own request interceptor (reads `platform_token` from `localStorage`) and response interceptor (on `401`, clears `platform_token` and redirects to `/platform/login`).

- [ ] **Step 1: Add `platformApi` to `api.js`**

In `alumni-frontend/src/api.js`, add after the existing `api` interceptors (after the closing `);` of the `api.interceptors.response.use(...)` call, i.e. at the end of the file):

```js
export const platformApi = axios.create({
  baseURL: '/api/platform/admin',
});

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('platform_token');
      if (window.location.pathname !== '/platform/login') {
        window.location.href = '/platform/login';
      }
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 2: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/api.js` — expect 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add alumni-frontend/src/api.js
git commit -m "feat(frontend): add a separate platformApi instance with its own token key"
```

---

## Task 6: Frontend — Platform signup and login pages

**Files:**
- Create: `alumni-frontend/src/pages/PlatformSignup.jsx`
- Create: `alumni-frontend/src/pages/PlatformLogin.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `Panel, Button, Input, Wordmark` from `../components/ui`; `platformApi` from `../api`.
- Produces: routes `/platform/signup`, `/platform/login`.

- [ ] **Step 1: Create `alumni-frontend/src/pages/PlatformLogin.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowRight } from 'lucide-react';
import { platformApi } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function PlatformLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await platformApi.post('/login', { email, password });
      localStorage.setItem('platform_token', data.token);
      nav('/platform/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-ink)] p-6">
      <Panel className="max-w-md w-full p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
            <Shield className="text-white" size={22} />
          </div>
          <div>
            <Wordmark />
            <p className="text-xs text-slate-500 leading-tight">Platform Admin</p>
          </div>
        </div>

        <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Sign in</h1>
        <p className="text-slate-500 mb-6 text-sm">Platform operator access only.</p>

        {err && (
          <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-4 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input type="password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : <>Sign in <ArrowRight size={18} /></>}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/" className="text-[var(--brand-accent)] hover:underline font-bold">Back to home</Link>
        </p>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Create `alumni-frontend/src/pages/PlatformSignup.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { platformApi } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function PlatformSignup() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [alreadySetUp, setAlreadySetUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await platformApi.post('/signup', { email, password });
      localStorage.setItem('platform_token', data.token);
      nav('/platform/dashboard');
    } catch (e) {
      if (e.response?.status === 403) {
        setAlreadySetUp(true);
      } else {
        setErr(e.response?.data?.error || 'Signup failed');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-ink)] p-6">
      <Panel className="max-w-md w-full p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
            <Shield className="text-white" size={22} />
          </div>
          <div>
            <Wordmark />
            <p className="text-xs text-slate-500 leading-tight">Platform Admin</p>
          </div>
        </div>

        {alreadySetUp ? (
          <>
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Already set up</h1>
            <p className="text-slate-500 mb-6 text-sm">A platform admin account already exists. This signup is closed.</p>
            <Link to="/platform/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Set up platform admin</h1>
            <p className="text-slate-500 mb-6 text-sm">One-time setup. This form closes itself after the first account.</p>

            {err && (
              <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-4 text-sm">
                {err}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating...' : <>Create Platform Admin <ArrowRight size={18} /></>}
              </Button>
            </form>
          </>
        )}
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Wire both routes into `App.jsx`, and make `Shell` bypass them entirely**

Add the imports, alongside the existing page imports:
```jsx
import PlatformSignup from './pages/PlatformSignup';
import PlatformLogin from './pages/PlatformLogin';
```

Add the routes, alongside `/signup`:
```jsx
        <Route path="/platform/signup" element={<PlatformSignup />} />
        <Route path="/platform/login" element={<PlatformLogin />} />
```

In `Shell`, add an early bypass before the existing `publicOnlyRoutes` logic:

```jsx
function Shell({ children }) {
  const { user, trialExpired } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (location.pathname.startsWith('/platform')) return <>{children}</>;

  // Public routes (no sidebar)
  const publicOnlyRoutes = ['/', '/login', '/register', '/signup'];
  const showSidebar = user && !publicOnlyRoutes.includes(location.pathname);

  if (user && trialExpired) return <TrialExpired />;
  if (!showSidebar) return <>{children}</>;
```

- [ ] **Step 4: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/pages/PlatformSignup.jsx src/pages/PlatformLogin.jsx src/App.jsx` — expect 0 new errors.
Run: `npm run dev`, visit `/platform/signup`, create the master account, confirm redirect to `/platform/dashboard` (will 404/blank until Task 7 — that's expected at this point). Visit `/platform/signup` again and confirm it now shows "Already set up" instead of the form.

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/src/pages/PlatformSignup.jsx alumni-frontend/src/pages/PlatformLogin.jsx alumni-frontend/src/App.jsx
git commit -m "feat(frontend): add platform admin signup and login pages"
```

---

## Task 7: Frontend — Platform dashboard

**Files:**
- Create: `alumni-frontend/src/pages/PlatformDashboard.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `Panel, Button, Badge, Input, Wordmark` from `../components/ui`; `platformApi` from `../api`.
- Produces: route `/platform/dashboard`.

- [ ] **Step 1: Create `alumni-frontend/src/pages/PlatformDashboard.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Power, CreditCard, Clock, Trash2, LogOut } from 'lucide-react';
import { platformApi } from '../api';
import { Panel, Button, Badge, Input, Wordmark } from '../components/ui';

export default function PlatformDashboard() {
  const nav = useNavigate();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [deleteErr, setDeleteErr] = useState('');

  const load = () => {
    setLoading(true);
    platformApi.get('/schools').then((r) => setSchools(r.data.schools)).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!localStorage.getItem('platform_token')) {
      nav('/platform/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (school) => {
    await platformApi.patch(`/schools/${school.id}`, { active: !school.active });
    load();
  };

  const markActive = async (school) => {
    await platformApi.patch(`/schools/${school.id}`, { plan: 'active' });
    load();
  };

  const extendTrial = async (school) => {
    await platformApi.patch(`/schools/${school.id}`, { extendTrialDays: 30 });
    load();
  };

  const confirmDelete = async () => {
    setDeleteErr('');
    try {
      await platformApi.delete(`/schools/${deleteTarget.id}`, { data: { confirmSlug } });
      setDeleteTarget(null);
      setConfirmSlug('');
      load();
    } catch (e) {
      setDeleteErr(e.response?.data?.error || 'Delete failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('platform_token');
    nav('/platform/login');
  };

  const statusFor = (s) => {
    if (!s.active) return { label: 'Inactive', tone: 'danger' };
    if (s.plan === 'active') return { label: 'Active', tone: 'success' };
    if (new Date(s.trial_ends_at) < new Date()) return { label: 'Trial Expired', tone: 'danger' };
    return { label: 'Trialing', tone: 'warning' };
  };

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <Shield className="text-white" size={22} />
            </div>
            <div>
              <Wordmark />
              <p className="text-xs text-slate-500 leading-tight">Platform Admin</p>
            </div>
          </div>
          <Button variant="secondary" onClick={logout}>
            <LogOut size={16} /> Logout
          </Button>
        </div>

        <Panel className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading schools...</div>
          ) : schools.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No schools yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-[2.5px] border-[var(--brand-ink)] text-[var(--brand-ink)] text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 text-left font-bold">School</th>
                  <th className="py-3 px-4 text-left font-bold">Status</th>
                  <th className="py-3 px-4 text-left font-bold">Alumni</th>
                  <th className="py-3 px-4 text-left font-bold">Events</th>
                  <th className="py-3 px-4 text-left font-bold">Trial Ends</th>
                  <th className="py-3 px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => {
                  const status = statusFor(s);
                  return (
                    <tr key={s.id} className="border-t border-slate-200">
                      <td className="py-3 px-4">
                        <p className="font-bold text-[var(--brand-ink)]">{s.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{s.slug}</p>
                      </td>
                      <td className="py-3 px-4"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td className="py-3 px-4 text-slate-600">{s.alumni_count}</td>
                      <td className="py-3 px-4 text-slate-600">{s.event_count}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{new Date(s.trial_ends_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button onClick={() => toggleActive(s)} title={s.active ? 'Deactivate' : 'Activate'} className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                            <Power size={16} />
                          </button>
                          {s.plan === 'trial' && (
                            <>
                              <button onClick={() => markActive(s)} title="Mark plan active" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                                <CreditCard size={16} />
                              </button>
                              <button onClick={() => extendTrial(s)} title="Extend trial 30 days" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                                <Clock size={16} />
                              </button>
                            </>
                          )}
                          <button onClick={() => { setDeleteTarget(s); setConfirmSlug(''); setDeleteErr(''); }} title="Delete school" className="p-2 border-2 border-transparent hover:border-[var(--brand-danger)] rounded-[var(--radius)] text-[var(--brand-danger)]">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <Panel className="max-w-md w-full p-6">
            <h2 className="font-display text-xl text-[var(--brand-ink)] mb-2">Delete {deleteTarget.name}?</h2>
            <p className="text-sm text-slate-600 mb-4">
              This permanently deletes the school and every alumni, event, job, and message that belongs to it. Type <span className="font-mono font-bold">{deleteTarget.slug}</span> to confirm.
            </p>
            {deleteErr && (
              <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-2 rounded-[var(--radius)] mb-3 text-xs">
                {deleteErr}
              </div>
            )}
            <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} placeholder={deleteTarget.slug} className="mb-4" />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" disabled={confirmSlug !== deleteTarget.slug} onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the route into `App.jsx`**

Add the import:
```jsx
import PlatformDashboard from './pages/PlatformDashboard';
```

Add the route, alongside `/platform/login`:
```jsx
        <Route path="/platform/dashboard" element={<PlatformDashboard />} />
```

- [ ] **Step 3: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/pages/PlatformDashboard.jsx src/App.jsx` — expect 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/PlatformDashboard.jsx alumni-frontend/src/App.jsx
git commit -m "feat(frontend): add platform admin dashboard"
```

---

## Task 8: Final full-stack verification

**Files:**
- None (verification-only task).

- [ ] **Step 1: Backend regression**

```bash
cd alumni-backend
NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand
```
Expected: 100% pass.

- [ ] **Step 2: Frontend lint and build**

```bash
cd alumni-frontend
node ./node_modules/eslint/bin/eslint.js .
node ./node_modules/vite/bin/vite.js build
```
Expected: no new lint errors beyond the pre-existing baseline, clean production build.

- [ ] **Step 3: End-to-end manual walkthrough**

With both backend (`node src/server.js`, port 4000) and frontend (`npm run dev`, port 5173) running:

1. Visit `http://localhost:5173/platform/signup`, create the master admin account. Confirm redirect to `/platform/dashboard` and that it lists every existing school (including `ihes`, `demo-school`, and any test schools created earlier) with correct alumni/event counts.
2. Visit `http://localhost:5173/platform/signup` again in a fresh/incognito context — confirm it shows "Already set up," not the form.
3. Click the deactivate action on a non-`ihes` test school; confirm that visiting that school's own subdomain (`<slug>.localhost:5173`) now returns "Unknown school" (404) instead of loading normally.
4. Reactivate it; confirm it works again.
5. On a trial-plan school, click "Mark plan active"; confirm the status badge changes to "Active" and that school's trial-expiry lock (from the school-signup-trial feature) no longer applies even with a past `trial_ends_at`.
6. On a different trial-plan school, click "Extend trial 30 days"; confirm `trial_ends_at` moves forward in the table.
7. Attempt to delete a school: open the modal, try submitting with the wrong text typed (button should stay disabled), then type the correct slug and confirm — verify the school disappears from the dashboard and that visiting its subdomain now 404s.
8. Confirm throughout that logging into a regular school (e.g. `ihes.localhost:5173/login`) in the same browser still works normally and is unaffected by any platform-admin session held in `localStorage['platform_token']`.

- [ ] **Step 4: No commit needed** — this task is verification-only.
