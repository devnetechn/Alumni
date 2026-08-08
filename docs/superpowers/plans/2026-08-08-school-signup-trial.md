# Self-Serve School Signup with Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new school sign itself up (name, subdomain slug, optional logo, first admin account) and get a 30-day trial; once it expires without being manually marked `active`, every user at that school is locked out until upgraded.

**Architecture:** First, re-establish the tenant-isolation backend (schools table, RLS, `resolveTenant` middleware, per-route `school_id` scoping) on top of current `main` by porting it wholesale from the already-built, already-tested `worktree-multi-tenant-core-isolation` branch — `alumni-backend` hasn't changed on `main` since that branch forked, so this is a clean mechanical port, not a re-implementation. Then add: a `logo`/`trial_ends_at` schema extension, a public `POST /api/platform/schools` signup endpoint, a public `GET /api/school` endpoint, trial-expiry enforcement inside `resolveTenant`, and the matching frontend (signup page, trial-expired page, logo swap-point).

**Tech Stack:** Express, `pg` (raw SQL, no ORM), Jest + Supertest for backend tests, React 19 + React Router, axios.

## Global Constraints

- No real payment processing — moving a school from `plan = 'trial'` to `plan = 'active'` is a manual DB update in this pass, per the design spec's explicit non-goal.
- The tenant-isolation port (Task 1) must not be hand-edited — copy the tested files from `worktree-multi-tenant-core-isolation` as-is, then verify with the existing test suite. Deviating from the tested version defeats the point of porting already-validated code.
- Every new/changed backend file ends in `alumni-backend/src/` or `alumni-backend/tests/`; every new/changed frontend file ends in `alumni-frontend/src/`.
- `schools.plan === 'trial' && trial_ends_at` in the past → every route except `/api/auth/login`, `/api/me`, and `/api/school` returns `402`.
- Logo storage follows the exact same client-side resize-to-400px-then-base64-JPEG pattern already used for `users.profile_pic` in `Profile.jsx` — no new file-upload infrastructure.

---

## Task 1: Port the tenant-isolation backend onto a new branch off main

**Files:**
- Modify (via port, not hand-edit): every file listed in `git diff main worktree-multi-tenant-core-isolation --stat -- alumni-backend` — `db/schema.sql`, `db/seed.js`, `src/db.js`, `src/lib/ai.js`, `src/lib/token.js`, `src/middleware/auth.js`, `src/middleware/tenant.js` (new), `src/routes/*.js`, `src/server.js`, `.env.example`, `README.md`, and every file under `tests/`.

**Interfaces:**
- Produces: `req.school` (`{ id, slug, name, active }`, extended in Task 2 with `logo, plan, trial_ends_at`) and `req.db(text, params)` (school-scoped query function), both set by `resolveTenant` middleware on every request past `/api/health`.

- [ ] **Step 1: Create the new branch off current main**

```bash
git checkout main
git pull
git checkout -b feat/school-signup-trial
```

- [ ] **Step 2: Port the entire `alumni-backend` tenant-isolation diff from the stale branch**

`alumni-backend` is byte-identical between `main` and `worktree-multi-tenant-core-isolation`'s fork point (verified: `git diff f8b2aef main -- alumni-backend` is empty), so this is a clean checkout, not a merge:

```bash
git checkout worktree-multi-tenant-core-isolation -- alumni-backend
git status --short
```

Expect to see every file from the stat list above as modified/added, and nothing else.

- [ ] **Step 3: Set up the local Postgres roles and databases**

```bash
cd alumni-backend
npm install
npm run migrate
npm run migrate:test
```

`migrate`/`migrate:test` apply `db/schema.sql`, which creates the `alumni_app` role (if missing) and the `schools` table alongside the RLS policies — this is idempotent, safe to re-run.

- [ ] **Step 4: Verify the ported backend passes its own test suite**

```bash
npm test
```

Expected: all tests pass, including `tests/tenant.test.js` and `tests/tenant-isolation.test.js`. This confirms the port is clean before building anything new on top of it.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend
git commit -m "feat(backend): port tenant-isolation foundation (schools, RLS, tenant middleware) onto current main"
```

---

## Task 2: Schema extension — `logo` and `trial_ends_at`

**Files:**
- Modify: `alumni-backend/db/schema.sql`
- Modify: `alumni-backend/src/middleware/tenant.js:11,20` (the two `SELECT` statements)

**Interfaces:**
- Produces: `schools.logo TEXT` (nullable), `schools.trial_ends_at TIMESTAMPTZ NOT NULL`. Extends `req.school` to include `logo`, `plan`, `trial_ends_at`.

- [ ] **Step 1: Append the new columns to `schema.sql`**

Add at the end of `alumni-backend/db/schema.sql` (after the existing `GRANT`/`ALTER DEFAULT PRIVILEGES` lines):

```sql
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days');
```

- [ ] **Step 2: Update the two `SELECT` statements in `resolveTenant` to fetch the new columns**

In `alumni-backend/src/middleware/tenant.js`, both occurrences of:
```js
'SELECT id, slug, name, active FROM schools WHERE slug = $1'
```
and
```js
'SELECT id, slug, name, active FROM schools WHERE id = $1'
```
become:
```js
'SELECT id, slug, name, logo, plan, trial_ends_at, active FROM schools WHERE slug = $1'
```
and
```js
'SELECT id, slug, name, logo, plan, trial_ends_at, active FROM schools WHERE id = $1'
```
respectively (only the column list changes, not the `WHERE` clause or bound params).

- [ ] **Step 3: Apply and verify**

```bash
cd alumni-backend
npm run migrate
npm run migrate:test
npm test
```

Expected: still all green — this step only adds columns, doesn't change any existing behavior yet.

- [ ] **Step 4: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/src/middleware/tenant.js
git commit -m "feat(backend): add schools.logo and schools.trial_ends_at columns"
```

---

## Task 3: Trial-expiry enforcement in `resolveTenant`

**Files:**
- Modify: `alumni-backend/src/middleware/tenant.js`
- Test: `alumni-backend/tests/trial.test.js` (new)

**Interfaces:**
- Consumes: `req.school.plan`, `req.school.trial_ends_at` (from Task 2).
- Produces: `402` response `{ error: 'Trial expired', trialEndsAt }` for any request past a resolved, expired-trial school, except `/api/auth/login`, `/api/me`, `/api/school`.

- [ ] **Step 1: Add the enforcement check**

In `alumni-backend/src/middleware/tenant.js`, replace:

```js
    if (!school) {
      return res.status(404).json({ error: 'Unknown school' });
    }

    req.school = school;
    req.db = (text, params) => queryForSchool(school.id, text, params);
    next();
```

with:

```js
    if (!school) {
      return res.status(404).json({ error: 'Unknown school' });
    }

    req.school = school;
    req.db = (text, params) => queryForSchool(school.id, text, params);

    const trialExpired = school.plan === 'trial' && new Date(school.trial_ends_at) < new Date();
    const allowlist = ['/api/auth/login', '/api/me', '/api/school'];
    if (trialExpired && !allowlist.includes(req.path)) {
      return res.status(402).json({ error: 'Trial expired', trialEndsAt: school.trial_ends_at });
    }

    next();
```

- [ ] **Step 2: Write the failing tests**

Create `alumni-backend/tests/trial.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb, insertUser, authHeader, createSchool, hostFor } = require('./helpers');

afterAll(() => pool.end());

describe('trial expiry enforcement', () => {
  beforeEach(resetDb);

  test('a request from a school past trial_ends_at gets 402 on a normal route', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/events')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('Trial expired');
  });

  test('login still succeeds for an expired-trial school', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const password_hash = await require('../src/lib/password').hashPassword('password123');
    await query(
      `INSERT INTO users (school_id, email, password_hash) VALUES ($1, 'trial@test.com', $2)`,
      [school.id, password_hash]
    );

    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', hostFor(school))
      .send({ email: 'trial@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('/api/me stays reachable for an expired-trial school', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/me')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
  });

  test('a school on an active plan is never blocked, even past trial_ends_at', async () => {
    const school = await createSchool();
    await query(`UPDATE schools SET plan = 'active', trial_ends_at = now() - interval '1 day' WHERE id = $1`, [school.id]);
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/events')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
  });

  test('a school still within its trial window is not blocked', async () => {
    const school = await createSchool();
    const user = await insertUser({ school_id: school.id });

    const res = await request(app)
      .get('/api/events')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd alumni-backend
npm test -- trial.test.js
```

Expected: all 5 tests pass (the enforcement code from Step 1 is already in place, so this confirms it, rather than a strict red-then-green cycle — the check is small enough to write alongside its test).

- [ ] **Step 4: Commit**

```bash
git add alumni-backend/src/middleware/tenant.js alumni-backend/tests/trial.test.js
git commit -m "feat(backend): enforce trial expiry in resolveTenant middleware"
```

---

## Task 4: Self-serve signup endpoint

**Files:**
- Create: `alumni-backend/src/routes/platform.js`
- Modify: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/platform.test.js` (new)

**Interfaces:**
- Produces: `POST /api/platform/schools` — request body `{ name, slug, logo?, full_name?, email, password }`, response `201 { slug }` or `400`/`409` on validation failure. Registered *before* `resolveTenant` — no `req.school` needed or available.

- [ ] **Step 1: Create `alumni-backend/src/routes/platform.js`**

```js
const express = require('express');
const { pool } = require('../db');
const { hashPassword } = require('../lib/password');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const RESERVED_SLUGS = ['www', 'api', 'admin', 'app', 'platform', 'signup', 'static', 'mail'];
const SLUG_RE = /^[a-z0-9-]+$/;

router.post('/schools', asyncHandler(async (req, res) => {
  const { name, slug, logo, full_name, email, password } = req.body;

  if (!name || !slug || !email || !password) {
    return res.status(400).json({ error: 'name, slug, email, and password are required' });
  }
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return res.status(409).json({ error: 'That slug is reserved' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM schools WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That slug is already taken' });
    }

    const schoolRows = await client.query(
      `INSERT INTO schools (slug, name, logo) VALUES ($1, $2, $3) RETURNING id, slug`,
      [slug, name, logo || null]
    );
    const school = schoolRows.rows[0];

    const password_hash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (school_id, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [school.id, email, password_hash, full_name || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ slug: school.slug });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
```

- [ ] **Step 2: Register the route in `server.js`, before `resolveTenant`**

In `alumni-backend/src/server.js`, replace:

```js
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const { resolveTenant } = require('./middleware/tenant');
app.use(resolveTenant);
```

with:

```js
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const platformRoutes = require('./routes/platform');
app.use('/api/platform', platformRoutes);

const { resolveTenant } = require('./middleware/tenant');
app.use(resolveTenant);
```

- [ ] **Step 3: Write the failing tests**

Create `alumni-backend/tests/platform.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb } = require('./helpers');

afterAll(() => pool.end());

describe('POST /api/platform/schools', () => {
  beforeEach(resetDb);

  test('creates exactly one school and one admin user scoped to it', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'New School',
      slug: 'new-school',
      full_name: 'First Admin',
      email: 'admin@new-school.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('new-school');

    const schools = await query('SELECT * FROM schools WHERE slug = $1', ['new-school']);
    expect(schools).toHaveLength(1);
    expect(schools[0].plan).toBe('trial');
    expect(new Date(schools[0].trial_ends_at).getTime()).toBeGreaterThan(Date.now());

    const users = await query('SELECT * FROM users WHERE school_id = $1', [schools[0].id]);
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('admin');
    expect(users[0].email).toBe('admin@new-school.com');
  });

  test('stores the logo when provided', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Logo School',
      slug: 'logo-school',
      logo: 'data:image/jpeg;base64,abc123',
      email: 'admin@logo-school.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    const schools = await query('SELECT logo FROM schools WHERE slug = $1', ['logo-school']);
    expect(schools[0].logo).toBe('data:image/jpeg;base64,abc123');
  });

  test('rejects a reserved slug', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Admin Panel',
      slug: 'admin',
      email: 'a@b.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  test('rejects a malformed slug', async () => {
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Bad Slug',
      slug: 'Not Valid!',
      email: 'a@b.com',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  test('rejects a duplicate slug', async () => {
    await request(app).post('/api/platform/schools').send({
      name: 'First', slug: 'dupe-school', email: 'a@b.com', password: 'password123',
    });
    const res = await request(app).post('/api/platform/schools').send({
      name: 'Second', slug: 'dupe-school', email: 'c@d.com', password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  test('missing required fields returns 400', async () => {
    const res = await request(app).post('/api/platform/schools').send({ name: 'No Slug' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd alumni-backend
npm test -- platform.test.js
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/platform.js alumni-backend/src/server.js alumni-backend/tests/platform.test.js
git commit -m "feat(backend): add self-serve school signup endpoint"
```

---

## Task 5: Public school-info endpoint

**Files:**
- Create: `alumni-backend/src/routes/school.js`
- Modify: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/school.test.js` (new)

**Interfaces:**
- Produces: `GET /api/school` — no auth required, returns `{ name, logo }` for `req.school` (resolved by `resolveTenant`, which runs before this route).

- [ ] **Step 1: Create `alumni-backend/src/routes/school.js`**

```js
const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/school', asyncHandler(async (req, res) => {
  res.json({ name: req.school.name, logo: req.school.logo });
}));

module.exports = router;
```

- [ ] **Step 2: Register the route in `server.js`, after `resolveTenant`**

In `alumni-backend/src/server.js`, add after the existing `const authRoutes = require('./routes/auth'); app.use('/api/auth', authRoutes);` block:

```js
const schoolRoutes = require('./routes/school');
app.use('/api', schoolRoutes);
```

- [ ] **Step 3: Write the failing tests**

Create `alumni-backend/tests/school.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb, createSchool, hostFor } = require('./helpers');

afterAll(() => pool.end());

describe('GET /api/school', () => {
  beforeEach(resetDb);

  test('returns the resolved school\'s name and logo, no auth required', async () => {
    const school = await createSchool({ name: 'Logo Test School' });
    await query('UPDATE schools SET logo = $1 WHERE id = $2', ['data:image/jpeg;base64,xyz', school.id]);

    const res = await request(app).get('/api/school').set('Host', hostFor(school));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Logo Test School');
    expect(res.body.logo).toBe('data:image/jpeg;base64,xyz');
  });

  test('logo is null when the school has none', async () => {
    const school = await createSchool();
    const res = await request(app).get('/api/school').set('Host', hostFor(school));
    expect(res.status).toBe(200);
    expect(res.body.logo).toBeNull();
  });

  test('unknown subdomain still returns 404, same as any other route', async () => {
    const res = await request(app).get('/api/school').set('Host', 'nonexistent-school.example.com');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd alumni-backend
npm test -- school.test.js
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/school.js alumni-backend/src/server.js alumni-backend/tests/school.test.js
git commit -m "feat(backend): add public GET /api/school endpoint"
```

---

## Task 6: Full backend regression pass

**Files:**
- None (verification-only task).

- [ ] **Step 1: Run the complete backend test suite**

```bash
cd alumni-backend
npm test
```

Expected: every test file passes — the ported tenant-isolation suite (Task 1), the new schema (Task 2), trial enforcement (Task 3), signup (Task 4), and school-info (Task 5), plus every pre-existing route test, all green together.

- [ ] **Step 2: Re-seed and manually sanity-check with curl**

```bash
npm run seed
npm run dev &
sleep 1
curl -s -X POST http://localhost:4000/api/platform/schools \
  -H "Content-Type: application/json" \
  -d '{"name":"Manual Test School","slug":"manual-test","email":"admin@manual-test.com","password":"password123"}'
```

Expected: `{"slug":"manual-test"}` with HTTP 201. Stop the dev server afterward.

- [ ] **Step 3: No commit needed** — this task is verification-only; nothing changed.

---

## Task 7: Frontend — 402 handling and shared school/trial state

**Files:**
- Modify: `alumni-frontend/src/api.js`
- Modify: `alumni-frontend/src/auth.jsx`

**Interfaces:**
- Produces: `useAuth()` gains two new fields — `school` (`{ name, logo } | null`, fetched once on mount) and `trialExpired` (`{ trialEndsAt } | null`, set when any API call returns 402).

- [ ] **Step 1: Add a trial-expired hook point to `api.js`**

In `alumni-frontend/src/api.js`, replace the whole file with:

```js
import axios from 'axios';

// Same-origin: /api proxied to backend by Vite in dev, and by reverse proxy in prod.
export const API_BASE = '';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let trialExpiredHandler = null;
export function setTrialExpiredHandler(fn) {
  trialExpiredHandler = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    if (error.response && error.response.status === 402 && trialExpiredHandler) {
      trialExpiredHandler(error.response.data);
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 2: Add `school` and `trialExpired` state to `auth.jsx`**

In `alumni-frontend/src/auth.jsx`, add to the imports:
```jsx
import { api, setTrialExpiredHandler } from './api';
```
(replacing the existing `import { api } from './api';`)

Inside `AuthProvider`, after the existing `const [loading, setLoading] = useState(true);` line, add:
```jsx
  const [school, setSchool] = useState(null);
  const [trialExpired, setTrialExpired] = useState(null);
```

Add a new effect, alongside the existing two `useEffect` calls:
```jsx
  useEffect(() => {
    setTrialExpiredHandler((data) => setTrialExpired(data));
    api.get('/school').then((r) => setSchool(r.data)).catch(() => {});
  }, []);
```

Update the provider's value to expose the new fields:
```jsx
  return (
    <AuthCtx.Provider value={{ user, login, register, logout, loading, refresh, school, trialExpired }}>
      {children}
    </AuthCtx.Provider>
  );
```

- [ ] **Step 3: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/api.js src/auth.jsx` — expect 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/api.js alumni-frontend/src/auth.jsx
git commit -m "feat(frontend): expose school info and trial-expired state from auth context"
```

---

## Task 8: Frontend — Signup page

**Files:**
- Create: `alumni-frontend/src/pages/Signup.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `Panel, Button, Input, Wordmark` from `../components/ui`; `api` from `../api`.
- Produces: route `/signup`, public (no `Protected` wrapper, alongside `/login`/`/register` in `Shell`'s `publicOnlyRoutes`).

- [ ] **Step 1: Create `alumni-frontend/src/pages/Signup.jsx`**

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft, Upload } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function Signup() {
  const [form, setForm] = useState({ name: '', slug: '', full_name: '', email: '', password: '' });
  const [logo, setLogo] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

  const onName = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: f.slug === slugify(f.name) ? slugify(name) : f.slug }));
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setLogo(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/platform/schools', { ...form, logo: logo || undefined });
      const rest = window.location.host;
      window.location.href = `${window.location.protocol}//${data.slug}.${rest}/login`;
    } catch (e) {
      setErr(e.response?.data?.error || 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[var(--brand-ink)] hover:text-[var(--brand-accent)] mb-6 text-sm font-bold">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <Panel className="p-8 lg:p-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <GraduationCap className="text-white" size={22} />
            </div>
            <Wordmark />
          </div>

          <h1 className="font-display text-3xl text-[var(--brand-ink)] mb-2">Set up your school</h1>
          <p className="text-slate-500 mb-8">Start a 30-day free trial — no payment required.</p>

          {err && (
            <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-5 text-sm">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">School Name</label>
              <Input value={form.name} onChange={onName} required />
            </div>

            <div>
              <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Subdomain</label>
              <div className="flex items-center gap-2">
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} required />
                <span className="text-sm text-slate-500 whitespace-nowrap">.{window.location.host}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Logo (optional)</label>
              <div className="flex items-center gap-3">
                {logo && <img src={logo} alt="" className="w-12 h-12 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] object-cover" />}
                <label className="inline-flex items-center gap-2 cursor-pointer border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-xs uppercase tracking-wide px-4 py-2.5 bg-white text-[var(--brand-ink)] shadow-[3px_3px_0_var(--brand-ink)]">
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                  <Upload size={16} /> Upload
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Your Name</label>
                <Input value={form.full_name} onChange={update('full_name')} />
              </div>
              <div>
                <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Your Email</label>
                <Input type="email" value={form.email} onChange={update('email')} required />
              </div>
              <div>
                <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Password</label>
                <Input type="password" value={form.password} onChange={update('password')} required />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : <>Start Free Trial <ArrowRight size={18} /></>}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have a school? <Link to="/login" className="text-[var(--brand-accent)] hover:underline font-bold">Sign in</Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
```

The upload trigger is a `<label>` styled with `Button`'s own class strings (matching `Button`'s `secondary` variant) rather than the `Button` component itself — `Button` always renders a `<button>`, and a `<button>` nested inside a `<label>` is invalid HTML (interactive-in-interactive).

- [ ] **Step 2: Wire the route into `App.jsx`**

Add the import, alongside the existing page imports:
```jsx
import Signup from './pages/Signup';
```

Add the route, alongside `/register`:
```jsx
        <Route path="/signup" element={<Signup />} />
```

Add `/signup` to `Shell`'s public-routes list:
```jsx
  const publicOnlyRoutes = ['/', '/login', '/register', '/signup'];
```

- [ ] **Step 3: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/pages/Signup.jsx src/App.jsx` — expect 0 new errors.
Run: `npm run dev`, visit `/signup`, fill the form, submit, confirm it redirects to `<slug>.localhost:5173/login` and that logging in there works.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/Signup.jsx alumni-frontend/src/App.jsx
git commit -m "feat(frontend): add self-serve school signup page"
```

---

## Task 9: Frontend — Trial-expired page

**Files:**
- Create: `alumni-frontend/src/pages/TrialExpired.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `useAuth()`'s `trialExpired` and `user` (from Task 7).

- [ ] **Step 1: Create `alumni-frontend/src/pages/TrialExpired.jsx`**

```jsx
import { Clock, Mail } from 'lucide-react';
import { useAuth } from '../auth';
import { Panel, Wordmark } from '../components/ui';

export default function TrialExpired() {
  const { user, trialExpired, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-surface)] p-6">
      <Panel className="max-w-md w-full p-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2">
          <Wordmark />
        </div>
        <div className="mx-auto mb-4 w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-danger)] border-2 border-[var(--brand-ink)] flex items-center justify-center">
          <Clock className="text-white" size={26} />
        </div>
        <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Trial expired</h1>
        {trialExpired?.trialEndsAt && (
          <p className="text-xs text-slate-500 mb-4">
            Trial ended {new Date(trialExpired.trialEndsAt).toLocaleDateString()}
          </p>
        )}
        {isAdmin ? (
          <>
            <p className="text-slate-600 mb-6">Your school's trial has ended. Contact us to continue using the platform.</p>
            <a
              href="mailto:hello@yourapp.com?subject=Continue%20my%20school's%20subscription"
              className="inline-flex items-center gap-2 border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-xs uppercase tracking-wide px-4 py-2.5 bg-[var(--brand-accent)] text-white shadow-[3px_3px_0_var(--brand-ink)]"
            >
              <Mail size={16} /> Contact us
            </a>
          </>
        ) : (
          <p className="text-slate-600 mb-6">This school's trial has ended. An admin needs to renew access before you can continue.</p>
        )}
        <button onClick={logout} className="block mx-auto mt-6 text-sm text-slate-400 hover:text-[var(--brand-ink)] underline">
          Log out
        </button>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `Shell` in `App.jsx`**

Add the import:
```jsx
import TrialExpired from './pages/TrialExpired';
```

In `Shell`, change:
```jsx
function Shell({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Public routes (no sidebar)
  const publicOnlyRoutes = ['/', '/login', '/register', '/signup'];
  const showSidebar = user && !publicOnlyRoutes.includes(location.pathname);

  if (!showSidebar) return <>{children}</>;
```

to:
```jsx
function Shell({ children }) {
  const { user, trialExpired } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Public routes (no sidebar)
  const publicOnlyRoutes = ['/', '/login', '/register', '/signup'];
  const showSidebar = user && !publicOnlyRoutes.includes(location.pathname);

  if (user && trialExpired) return <TrialExpired />;
  if (!showSidebar) return <>{children}</>;
```

- [ ] **Step 3: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/pages/TrialExpired.jsx src/App.jsx` — expect 0 new errors.
Run: `npm run dev`. Manually expire a test school's trial (`UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE slug = '...'` via `psql`), log in as that school's admin, confirm every page now shows `TrialExpired` instead of the app, with the "Contact us" mailto link; confirm a non-admin user at the same school sees the non-admin message instead.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/TrialExpired.jsx alumni-frontend/src/App.jsx
git commit -m "feat(frontend): show a trial-expired screen when the API returns 402"
```

---

## Task 10: Frontend — logo swap-point

**Files:**
- Modify: `alumni-frontend/src/App.jsx` (Sidebar, MobileHeader)
- Modify: `alumni-frontend/src/pages/PublicHome.jsx` (header)
- Modify: `alumni-frontend/src/pages/Login.jsx` (left panel + mobile header)

**Interfaces:**
- Consumes: `useAuth()`'s `school` field (from Task 7) — `{ name, logo } | null`.

- [ ] **Step 1: `App.jsx` Sidebar — swap the icon badge for the logo when present**

In `Sidebar`, change:
```jsx
function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
```
to:
```jsx
function Sidebar({ open, onClose }) {
  const { user, logout, school } = useAuth();
```

Change the badge markup:
```jsx
          <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] rounded-[var(--radius)] p-2">
            <GraduationCap className="text-white" size={22} />
          </div>
          <div>
            <Wordmark />
            <p className="text-xs text-slate-500 leading-tight">IHES Alumni Association</p>
          </div>
```
to:
```jsx
          {school?.logo ? (
            <img src={school.logo} alt="" className="w-9 h-9 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] object-cover" />
          ) : (
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] rounded-[var(--radius)] p-2">
              <GraduationCap className="text-white" size={22} />
            </div>
          )}
          <div>
            <Wordmark />
            <p className="text-xs text-slate-500 leading-tight">{school?.name || 'IHES Alumni Association'}</p>
          </div>
```

- [ ] **Step 2: `App.jsx` MobileHeader — same swap**

Change:
```jsx
function MobileHeader({ onMenu }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-white border-b-[2.5px] border-[var(--brand-ink)] px-4 py-3 flex items-center gap-3">
      <button onClick={onMenu} className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        <GraduationCap className="text-[var(--brand-accent)]" size={20} />
        <Wordmark />
      </div>
    </header>
  );
}
```
to:
```jsx
function MobileHeader({ onMenu }) {
  const { user, school } = useAuth();
  if (!user) return null;
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-white border-b-[2.5px] border-[var(--brand-ink)] px-4 py-3 flex items-center gap-3">
      <button onClick={onMenu} className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        {school?.logo ? (
          <img src={school.logo} alt="" className="w-5 h-5 rounded object-cover" />
        ) : (
          <GraduationCap className="text-[var(--brand-accent)]" size={20} />
        )}
        <Wordmark />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `PublicHome.jsx` header — replace the hardcoded `logo = null` swap point with real data**

Remove the hardcoded constant (lines near the top):
```jsx
// Swap point: once the real school logo is supplied, save it as
// src/assets/logo.svg, then uncomment the import below and delete the
// `const logo = null;` line.
// import logo from '../assets/logo.svg';
const logo = null;
```

In `PublicHome`, add `school` from `useAuth()`:
```jsx
export default function PublicHome() {
  const { user, school } = useAuth();
```

Change the header badge:
```jsx
          <Link to="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="Alumni logo" className="h-9 w-9 rounded-[var(--radius)] object-contain" />
            ) : (
              <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-white">
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <Wordmark className="text-white" />
          </Link>
```
to:
```jsx
          <Link to="/" className="flex items-center gap-2">
            {school?.logo ? (
              <img src={school.logo} alt="" className="h-9 w-9 rounded-[var(--radius)] border-2 border-white object-cover" />
            ) : (
              <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-white">
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <Wordmark className="text-white" />
          </Link>
```

- [ ] **Step 4: `Login.jsx` left panel and mobile header — same swap**

Add `school` to the destructure:
```jsx
export default function Login() {
  const { login, school } = useAuth();
```

Change the left panel badge:
```jsx
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-white p-2 rounded-[var(--radius)]">
              <GraduationCap size={22} />
            </div>
            <Wordmark className="text-white" />
          </Link>
```
to:
```jsx
          <Link to="/" className="flex items-center gap-2">
            {school?.logo ? (
              <img src={school.logo} alt="" className="w-9 h-9 rounded-[var(--radius)] border-2 border-white object-cover" />
            ) : (
              <div className="bg-[var(--brand-accent)] border-2 border-white p-2 rounded-[var(--radius)]">
                <GraduationCap size={22} />
              </div>
            )}
            <Wordmark className="text-white" />
          </Link>
```

And the mobile-only badge (the `lg:hidden` block):
```jsx
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <GraduationCap className="text-white" size={22} />
            </div>
            <Wordmark />
          </div>
```
to:
```jsx
          <div className="lg:hidden mb-8 flex items-center gap-2">
            {school?.logo ? (
              <img src={school.logo} alt="" className="w-9 h-9 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] object-cover" />
            ) : (
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <Wordmark />
          </div>
```

- [ ] **Step 5: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/App.jsx src/pages/PublicHome.jsx src/pages/Login.jsx` — expect 0 new errors (note: removing the `logo`/`import` constant from `PublicHome.jsx` must not leave an unused import behind).
Run: `npm run dev`. Sign up a new school with a logo via `/signup`, then visit that school's `/`, `/login`, and (after logging in) the sidebar/mobile header — confirm the uploaded logo renders in all four places. Visit a school with no logo set and confirm the `GraduationCap` fallback still renders correctly.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/App.jsx alumni-frontend/src/pages/PublicHome.jsx alumni-frontend/src/pages/Login.jsx
git commit -m "feat(frontend): render each school's logo in place of the generic icon badge"
```

---

## Task 11: Final full-stack verification

**Files:**
- None (verification-only task).

- [ ] **Step 1: Backend regression**

```bash
cd alumni-backend
npm test
```
Expected: 100% pass.

- [ ] **Step 2: Frontend lint and build**

```bash
cd alumni-frontend
node ./node_modules/eslint/bin/eslint.js .
node ./node_modules/vite/bin/vite.js build
```
Expected: no new lint errors beyond the pre-existing baseline (the `react-hooks/set-state-in-effect` pattern already present throughout the app), and a clean production build.

- [ ] **Step 3: End-to-end manual walkthrough**

With both `npm run dev` (backend, port 4000) and `npm run dev` (frontend, port 5173) running:

1. Visit `http://localhost:5173/signup`, create a school with a logo, submit.
2. Confirm redirect to `http://<slug>.localhost:5173/login`.
3. Log in with the admin credentials just created; confirm the dashboard loads, the sidebar shows the uploaded logo and school name, and the trial banner is absent (still within 30 days).
4. Via `psql`, run `UPDATE schools SET trial_ends_at = now() - interval '1 day' WHERE slug = '<slug>';`.
5. Reload any page in the app; confirm `TrialExpired` renders with the admin message and "Contact us" mailto link.
6. Log out, confirm `/login` and `/` (landing page) still render that school's logo correctly even while trial-expired (since `GET /api/school` is allowlisted).
7. Via `psql`, run `UPDATE schools SET plan = 'active' WHERE slug = '<slug>';`, reload, confirm the app is accessible again.
8. Visit `ihes.localhost:5173` (the original seeded school) and confirm it's completely unaffected throughout — still on `plan = 'trial'` with its original `trial_ends_at`, still fully accessible.

- [ ] **Step 4: No commit needed** — this task is verification-only.
