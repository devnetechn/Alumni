# Alumni Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Node/Express + PostgreSQL backend for `alumni-frontend`, implementing every endpoint the frontend already calls, plus Socket.io real-time for messages/notifications.

**Architecture:** Resource-based Express route modules (routes + SQL colocated, no ORM), a single `pg.Pool`, JWT auth via middleware, Socket.io attached to the same HTTP server. Full rationale and API contract: `docs/superpowers/specs/2026-08-01-alumni-backend-design.md`.

**Tech Stack:** Node 22, Express 4, `pg`, `bcryptjs`, `jsonwebtoken`, `socket.io` (+ `socket.io-client` on the frontend), `cors`, `dotenv`, Jest + Supertest for tests.

## Global Constraints

- Backend lives in `alumni-backend/`, frontend in `alumni-frontend/` (existing, do not restructure).
- API base path is `/api` (Express app mounts all routers under `/api`), port `4000` — matches `alumni-frontend/vite.config.js` proxy already in place. Do not change the proxy.
- Database: PostgreSQL running locally on **port 8000** (non-default — verified via `Get-NetTCPConnection`), user `postgres`, password `123`. Dev DB name: `alumni`. Test DB name: `alumni_test`.
- Use `bcryptjs` (pure JS) instead of `bcrypt` (native bindings) — avoids requiring node-gyp/Visual Studio build tools on this Windows machine. Same algorithm, drop-in API.
- Every route module's tests run against the real `alumni_test` Postgres database via Supertest — no mocking the DB.
- Register always creates role `alumni`; only seed data or `PUT /admin/users/:id` can create/promote an `admin`.
- `password_hash` must never appear in any JSON response.

---

## File Structure

```
alumni-backend/
  .env                      — gitignored, real local secrets
  .env.example              — committed template
  .gitignore
  package.json
  jest.config.js
  src/
    server.js                — Express app + http.Server + Socket.io bootstrap; exports `app` for tests
    db.js                    — pg Pool + query() helper
    middleware/
      auth.js                 — requireAuth, requireAdmin, requireOfficer
    lib/
      token.js                 — signToken, verifyToken
      password.js              — hashPassword, comparePassword
      socket.js                — initSocket(httpServer), emitToUser(userId, event, payload)
    routes/
      auth.js  me.js  alumni.js  events.js  jobs.js
      announcements.js  messages.js  groups.js  notifications.js
      admin.js  stats.js
  db/
    schema.sql
    seed.js
  scripts/
    migrate.js
  tests/
    helpers.js                — resetDb(), insertUser(overrides), authHeader(user)
    health.test.js
    schema.test.js
    auth.test.js
    me.test.js
    alumni.test.js
    events.test.js
    event-registrations.test.js
    jobs.test.js
    announcements.test.js
    messages.test.js
    groups.test.js
    notifications.test.js
    admin.test.js
    stats.test.js
    socket.test.js
```

---

### Task 1: Project scaffolding + health check

**Files:**
- Create: `alumni-backend/package.json`
- Create: `alumni-backend/.gitignore`
- Create: `alumni-backend/.env.example`
- Create: `alumni-backend/.env` (not committed)
- Create: `alumni-backend/jest.config.js`
- Create: `alumni-backend/src/db.js`
- Create: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/health.test.js`

**Interfaces:**
- Produces: `db.js` exports `{ pool, query(text, params) }` where `query` returns `Promise<rows[]>` via `pool.query(text, params).then(r => r.rows)`.
- Produces: `server.js` exports `app` (the Express instance) without calling `.listen()` at import time — listening happens only when the file is run directly (`if (require.main === module)`), so tests can `require('../src/server').app` and drive it with Supertest without binding a port.

- [ ] **Step 1: Create `alumni-backend/package.json`**

```json
{
  "name": "alumni-backend",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "main": "src/server.js",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "migrate": "node scripts/migrate.js",
    "migrate:test": "cross-env NODE_ENV=test node scripts/migrate.js",
    "seed": "node db/seed.js",
    "test": "cross-env NODE_ENV=test jest --runInBand"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.12.0",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "cross-env": "^7.0.3",
    "jest": "^29.7.0",
    "socket.io-client": "^4.7.5",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create `alumni-backend/.gitignore`**

```
node_modules
.env
```

- [ ] **Step 3: Create `alumni-backend/.env.example` and `alumni-backend/.env`**

`.env.example`:
```
DATABASE_URL=postgres://postgres:123@localhost:8000/alumni
TEST_DATABASE_URL=postgres://postgres:123@localhost:8000/alumni_test
JWT_SECRET=change-me-in-production
PORT=4000
```

`.env` (same content — this is the real local file, gitignored):
```
DATABASE_URL=postgres://postgres:123@localhost:8000/alumni
TEST_DATABASE_URL=postgres://postgres:123@localhost:8000/alumni_test
JWT_SECRET=dev-secret-not-for-production
PORT=4000
```

- [ ] **Step 4: Install dependencies**

Run: `cd alumni-backend && npm install`
Expected: `node_modules` created, no errors.

- [ ] **Step 5: Create `alumni-backend/jest.config.js`**

```js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
};
```

- [ ] **Step 6: Create `alumni-backend/src/db.js`**

```js
require('dotenv').config();
const { Pool } = require('pg');

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

module.exports = { pool, query };
```

- [ ] **Step 7: Create `alumni-backend/src/server.js`**

```js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  const http = require('http');
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`alumni-backend listening on port ${PORT}`);
  });
}

module.exports = { app };
```

- [ ] **Step 8: Write the failing test — `alumni-backend/tests/health.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');

test('GET /api/health returns ok', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});
```

- [ ] **Step 9: Create the two Postgres databases (one-time, manual)**

Run:
```
PGPASSWORD=123 "/c/Program Files/PostgreSQL/17/bin/psql.exe" -U postgres -h localhost -p 8000 -c "CREATE DATABASE alumni;"
PGPASSWORD=123 "/c/Program Files/PostgreSQL/17/bin/psql.exe" -U postgres -h localhost -p 8000 -c "CREATE DATABASE alumni_test;"
```
Expected: both print `CREATE DATABASE`.

- [ ] **Step 10: Run the test**

Run: `cd alumni-backend && npm test -- health.test.js`
Expected: PASS (this test needs no DB, so it passes even before schema exists).

- [ ] **Step 11: Commit**

```bash
git add alumni-backend/package.json alumni-backend/.gitignore alumni-backend/.env.example alumni-backend/jest.config.js alumni-backend/src/db.js alumni-backend/src/server.js alumni-backend/tests/health.test.js
git commit -m "feat(backend): scaffold alumni-backend with health check"
```

---

### Task 2: Database schema + migrate script

**Files:**
- Create: `alumni-backend/db/schema.sql`
- Create: `alumni-backend/scripts/migrate.js`
- Test: `alumni-backend/tests/schema.test.js`

**Interfaces:**
- Consumes: `src/db.js` `query()` (Task 1).
- Produces: after `npm run migrate:test`, the `alumni_test` database has all 11 tables from the design spec's data model. Every later task's tests depend on this schema existing.

- [ ] **Step 1: Create `alumni-backend/db/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'alumni' CHECK (role IN ('admin','alumni')),
  active BOOLEAN NOT NULL DEFAULT true,
  is_batch_leader BOOLEAN NOT NULL DEFAULT false,
  full_name TEXT,
  batch_year INTEGER,
  course TEXT,
  contact TEXT,
  address TEXT,
  company TEXT,
  position TEXT,
  industry TEXT,
  bio TEXT,
  profile_pic TEXT,
  mentor_available BOOLEAN NOT NULL DEFAULT false,
  nfc_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going','maybe','not_going')),
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_checkins (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_in_by INTEGER REFERENCES users(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  description TEXT,
  job_type TEXT NOT NULL DEFAULT 'job' CHECK (job_type IN ('job','internship')),
  is_referral BOOLEAN NOT NULL DEFAULT false,
  posted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  posted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'interest' CHECK (kind IN ('interest','batch','course','mentorship')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_posts (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Create `alumni-backend/scripts/migrate.js`**

```js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

async function migrate() {
  const pool = new Pool({ connectionString });
  const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await pool.query(sql);
  await pool.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Write the failing test — `alumni-backend/tests/schema.test.js`**

```js
const { pool } = require('../src/db');

afterAll(() => pool.end());

test('all expected tables exist after migration', async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const names = rows.map((r) => r.table_name).sort();
  expect(names).toEqual([
    'announcements', 'event_checkins', 'event_rsvps', 'events',
    'group_members', 'group_posts', 'groups', 'jobs',
    'messages', 'notifications', 'users',
  ]);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd alumni-backend && npm test -- schema.test.js`
Expected: FAIL (tables don't exist yet — connection to `alumni_test` may work but the query returns empty array, so the assertion fails).

- [ ] **Step 5: Apply the schema**

Run: `cd alumni-backend && npm run migrate:test`
Expected: prints `Migration complete.`

- [ ] **Step 6: Run test to verify it passes**

Run: `cd alumni-backend && npm test -- schema.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/scripts/migrate.js alumni-backend/tests/schema.test.js
git commit -m "feat(backend): add database schema and migrate script"
```

---

### Task 3: Test helpers, password/token libs, auth middleware

**Files:**
- Create: `alumni-backend/src/lib/password.js`
- Create: `alumni-backend/src/lib/token.js`
- Create: `alumni-backend/src/middleware/auth.js`
- Create: `alumni-backend/tests/helpers.js`
- Test: `alumni-backend/tests/middleware-auth.test.js`

**Interfaces:**
- Produces: `lib/password.js` → `{ hashPassword(plain): Promise<string>, comparePassword(plain, hash): Promise<boolean> }`
- Produces: `lib/token.js` → `{ signToken(user): string, verifyToken(token): { id, role } }` where `user` is `{ id, role }`. Token payload is `{ id, role }`.
- Produces: `middleware/auth.js` → `{ requireAuth, requireAdmin, requireOfficer }`. `requireAuth` reads `Authorization: Bearer <token>`, verifies it, loads the full user row from `users` by id, attaches it as `req.user` (with `password_hash` deleted), calls `next()`, or responds `401 {error}`. `requireAdmin` runs after `requireAuth` and checks `req.user.role === 'admin'`, else `403`. `requireOfficer` allows `req.user.role === 'admin' || req.user.is_batch_leader`, else `403`.
- Produces: `tests/helpers.js` → `{ resetDb(), insertUser(overrides): Promise<user>, authHeader(user): string }`. `insertUser` inserts directly into `users` with sane defaults (`role: 'alumni'`, a bcrypt hash of `'password123'`) merged with `overrides`, and returns the full row. `authHeader(user)` returns `` `Bearer ${signToken(user)}` ``. Every later route test file uses these.

- [ ] **Step 1: Create `alumni-backend/src/lib/password.js`**

```js
const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
```

- [ ] **Step 2: Create `alumni-backend/src/lib/token.js`**

```js
require('dotenv').config();
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
```

- [ ] **Step 3: Create `alumni-backend/src/middleware/auth.js`**

```js
const { verifyToken } = require('../lib/token');
const { query } = require('../db');

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

  const rows = await query('SELECT * FROM users WHERE id = $1', [payload.id]);
  if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

  const user = rows[0];
  delete user.password_hash;
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function requireOfficer(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.is_batch_leader) {
    return res.status(403).json({ error: 'Officer access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireOfficer };
```

- [ ] **Step 4: Create `alumni-backend/tests/helpers.js`**

```js
const { pool, query } = require('../src/db');
const { hashPassword } = require('../src/lib/password');
const { signToken } = require('../src/lib/token');

async function resetDb() {
  await pool.query(`
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_checkins, event_rsvps, events, users
    RESTART IDENTITY CASCADE
  `);
}

async function insertUser(overrides = {}) {
  const password_hash = await hashPassword('password123');
  const defaults = {
    email: `user${Date.now()}${Math.random().toString(16).slice(2)}@test.com`,
    role: 'alumni',
    active: true,
    is_batch_leader: false,
    full_name: 'Test User',
    batch_year: 2020,
    course: 'BSCS',
  };
  const data = { ...defaults, ...overrides, password_hash };
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

module.exports = { resetDb, insertUser, authHeader };
```

- [ ] **Step 5: Write the failing test — `alumni-backend/tests/middleware-auth.test.js`**

```js
const express = require('express');
const request = require('supertest');
const { pool } = require('../src/db');
const { requireAuth, requireAdmin } = require('../src/middleware/auth');
const { resetDb, insertUser, authHeader } = require('./helpers');

const app = express();
app.get('/protected', requireAuth, (req, res) => res.json({ id: req.user.id }));
app.get('/admin-only', requireAuth, requireAdmin, (req, res) => res.json({ ok: true }));

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('rejects requests with no token', async () => {
  const res = await request(app).get('/protected');
  expect(res.status).toBe(401);
});

test('accepts a valid token and attaches req.user', async () => {
  const user = await insertUser();
  const res = await request(app).get('/protected').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(user.id);
});

test('requireAdmin rejects non-admin users', async () => {
  const user = await insertUser({ role: 'alumni' });
  const res = await request(app).get('/admin-only').set('Authorization', authHeader(user));
  expect(res.status).toBe(403);
});

test('requireAdmin accepts admin users', async () => {
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app).get('/admin-only').set('Authorization', authHeader(admin));
  expect(res.status).toBe(200);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd alumni-backend && npm test -- middleware-auth.test.js`
Expected: FAIL (modules don't exist yet, or DB not reachable in the right shape) — confirm the failure is about the missing pieces you're about to add, not a typo.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd alumni-backend && npm test -- middleware-auth.test.js`
Expected: PASS (all 4 tests)

- [ ] **Step 8: Commit**

```bash
git add alumni-backend/src/lib alumni-backend/src/middleware alumni-backend/tests/helpers.js alumni-backend/tests/middleware-auth.test.js
git commit -m "feat(backend): add auth middleware, password/token libs, and shared test helpers"
```

---

### Task 4: Auth routes — register & login

**Files:**
- Create: `alumni-backend/src/routes/auth.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/auth.test.js`

**Interfaces:**
- Consumes: `hashPassword`, `comparePassword` (Task 3 `lib/password.js`), `signToken` (Task 3 `lib/token.js`), `query` (Task 1 `db.js`).
- Produces: `routes/auth.js` exports an Express `Router` mounted at `/api/auth`. `POST /register` body `{email, password, full_name, batch_year, course, contact, company, position, industry}` → `201 {token, user}`. `POST /login` body `{email, password}` → `200 {token, user}` or `401 {error}`. `user` in both responses never contains `password_hash`.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/auth.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('POST /api/auth/register creates an alumni user and returns a token', async () => {
  const res = await request(app).post('/api/auth/register').send({
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

test('POST /api/auth/register rejects a duplicate email', async () => {
  await insertUser({ email: 'dupe@test.com' });
  const res = await request(app).post('/api/auth/register').send({
    email: 'dupe@test.com',
    password: 'secret123',
    full_name: 'Dupe',
  });
  expect(res.status).toBe(409);
});

test('POST /api/auth/login succeeds with correct credentials', async () => {
  await request(app).post('/api/auth/register').send({
    email: 'login@test.com',
    password: 'secret123',
    full_name: 'Login Person',
  });
  const res = await request(app).post('/api/auth/login').send({
    email: 'login@test.com',
    password: 'secret123',
  });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
});

test('POST /api/auth/login rejects wrong password', async () => {
  await request(app).post('/api/auth/register').send({
    email: 'login2@test.com',
    password: 'secret123',
    full_name: 'Login Person 2',
  });
  const res = await request(app).post('/api/auth/login').send({
    email: 'login2@test.com',
    password: 'wrongpassword',
  });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- auth.test.js`
Expected: FAIL (`/api/auth/register` returns 404 — route doesn't exist yet)

- [ ] **Step 3: Create `alumni-backend/src/routes/auth.js`**

```js
const express = require('express');
const { query } = require('../db');
const { hashPassword, comparePassword } = require('../lib/password');
const { signToken } = require('../lib/token');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, full_name, batch_year, course, contact, company, position, industry } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await hashPassword(password);
  const rows = await query(
    `INSERT INTO users (email, password_hash, full_name, batch_year, course, contact, company, position, industry)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [email, password_hash, full_name || null, batch_year || null, course || null, contact || null, company || null, position || null, industry || null]
  );
  const user = rows[0];
  delete user.password_hash;
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const rows = await query('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

  const user = rows[0];
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  delete user.password_hash;
  res.json({ token: signToken(user), user });
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

Add near the top (after `app.use(express.json())`):
```js
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- auth.test.js`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/auth.js alumni-backend/src/server.js alumni-backend/tests/auth.test.js
git commit -m "feat(backend): add register and login routes"
```

---

### Task 5: `/me` routes (GET, PUT)

**Files:**
- Create: `alumni-backend/src/routes/me.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/me.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 3), `query` (Task 1).
- Produces: `routes/me.js` mounted at `/api` (routes are `/me` exactly, per frontend calls `api.get('/me')` / `api.put('/me')`). `GET /me` → `200 {me: user}`. `PUT /me` → `200 {me: updatedUser}`, accepts a whitelist of editable fields: `full_name, batch_year, course, contact, address, company, position, industry, bio, profile_pic, mentor_available, nfc_uid`. Ignores any attempt to set `role`, `active`, `is_batch_leader`, `email`, `password_hash` via this route.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/me.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/me returns the authenticated user profile', async () => {
  const user = await insertUser({ full_name: 'Ada Lovelace' });
  const res = await request(app).get('/api/me').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
  expect(res.body.me.full_name).toBe('Ada Lovelace');
  expect(res.body.me.password_hash).toBeUndefined();
});

test('PUT /api/me updates editable profile fields', async () => {
  const user = await insertUser();
  const res = await request(app)
    .put('/api/me')
    .set('Authorization', authHeader(user))
    .send({ full_name: 'Updated Name', bio: 'Hello world', mentor_available: true });
  expect(res.status).toBe(200);
  expect(res.body.me.full_name).toBe('Updated Name');
  expect(res.body.me.bio).toBe('Hello world');
  expect(res.body.me.mentor_available).toBe(true);
});

test('PUT /api/me cannot escalate role via request body', async () => {
  const user = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .put('/api/me')
    .set('Authorization', authHeader(user))
    .send({ role: 'admin', full_name: 'Still Alumni' });
  expect(res.status).toBe(200);
  expect(res.body.me.role).toBe('alumni');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- me.test.js`
Expected: FAIL (404, route not mounted yet)

- [ ] **Step 3: Create `alumni-backend/src/routes/me.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const EDITABLE_FIELDS = [
  'full_name', 'batch_year', 'course', 'contact', 'address', 'company',
  'position', 'industry', 'bio', 'profile_pic', 'mentor_available', 'nfc_uid',
];

router.get('/me', requireAuth, (req, res) => {
  res.json({ me: req.user });
});

router.put('/me', requireAuth, async (req, res) => {
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.json({ me: req.user });

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  const rows = await query(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.user.id]
  );
  const me = rows[0];
  delete me.password_hash;
  res.json({ me });
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const meRoutes = require('./routes/me');
app.use('/api', meRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- me.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/me.js alumni-backend/src/server.js alumni-backend/tests/me.test.js
git commit -m "feat(backend): add GET/PUT /me routes"
```

---

### Task 6: Alumni directory route

**Files:**
- Create: `alumni-backend/src/routes/alumni.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/alumni.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 3), `query` (Task 1).
- Produces: `routes/alumni.js` mounted at `/api`, route `GET /alumni`. Query params: `search, batch, course, industry, company, location, mentor`. Response `200 {alumni: [...]}`, each row aliased with `user_id` (frontend's `Directory.jsx`/`Messages.jsx` link to `/messages?to=${a.user_id}`, so the response must include a `user_id` field equal to `id`), and never includes `password_hash`.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/alumni.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/alumni requires auth', async () => {
  const res = await request(app).get('/api/alumni');
  expect(res.status).toBe(401);
});

test('GET /api/alumni lists alumni and includes user_id', async () => {
  const me = await insertUser();
  await insertUser({ full_name: 'Jane Doe', course: 'BSIT', batch_year: 2019 });
  const res = await request(app).get('/api/alumni').set('Authorization', authHeader(me));
  expect(res.status).toBe(200);
  expect(res.body.alumni.length).toBeGreaterThanOrEqual(2);
  expect(res.body.alumni[0].user_id).toBe(res.body.alumni[0].id);
  expect(res.body.alumni[0].password_hash).toBeUndefined();
});

test('GET /api/alumni filters by search text across name/company/position', async () => {
  const me = await insertUser();
  await insertUser({ full_name: 'Zed Zebra', company: 'Acme Corp' });
  await insertUser({ full_name: 'Someone Else', company: 'Other Inc' });
  const res = await request(app)
    .get('/api/alumni')
    .query({ search: 'Zebra' })
    .set('Authorization', authHeader(me));
  expect(res.status).toBe(200);
  expect(res.body.alumni.some((a) => a.full_name === 'Zed Zebra')).toBe(true);
  expect(res.body.alumni.some((a) => a.full_name === 'Someone Else')).toBe(false);
});

test('GET /api/alumni filters by mentor=1', async () => {
  const me = await insertUser();
  await insertUser({ full_name: 'Mentor Person', mentor_available: true });
  await insertUser({ full_name: 'Non Mentor', mentor_available: false });
  const res = await request(app)
    .get('/api/alumni')
    .query({ mentor: '1' })
    .set('Authorization', authHeader(me));
  expect(res.body.alumni.every((a) => a.mentor_available === true)).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- alumni.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/alumni.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/alumni', requireAuth, async (req, res) => {
  const { search, batch, course, industry, company, location, mentor } = req.query;
  const conditions = [];
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

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(
    `SELECT id, id AS user_id, email, full_name, batch_year, course, contact, address,
            company, position, industry, bio, profile_pic, mentor_available, nfc_uid, role
     FROM users ${where} ORDER BY full_name NULLS LAST`,
    values
  );
  res.json({ alumni: rows });
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const alumniRoutes = require('./routes/alumni');
app.use('/api', alumniRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- alumni.test.js`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/alumni.js alumni-backend/src/server.js alumni-backend/tests/alumni.test.js
git commit -m "feat(backend): add alumni directory search route"
```

---

### Task 7: Events — list, get, create, delete, RSVP

**Files:**
- Create: `alumni-backend/src/routes/events.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/events.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `requireAdmin` (Task 3), `query` (Task 1).
- Produces: `routes/events.js` exports an Express `Router` mounted at `/api/events`, and also exported directly as `router` so Task 8 can add more routes onto the same file. Routes: `GET /` → `{events: [...]}`; `GET /:id` → `{event}` or `404`; `POST /` (admin) → `201 {event}`; `DELETE /:id` (admin) → `204`; `GET /:id/rsvp` → `{counts: {going, maybe, not_going}, myStatus}`; `POST /:id/rsvp` body `{status}` → `200 {rsvp}` (upsert on `(event_id, user_id)`).

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/events.test.js`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- events.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/events.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const events = await query('SELECT * FROM events ORDER BY event_date ASC');
  res.json({ events });
});

router.get('/:id', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
  res.json({ event: rows[0] });
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, location, event_date } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: 'title and event_date are required' });
  const rows = await query(
    `INSERT INTO events (title, description, location, event_date, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [title, description || null, location || null, event_date, req.user.id]
  );
  res.status(201).json({ event: rows[0] });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await query('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

router.get('/:id/rsvp', requireAuth, async (req, res) => {
  const eventId = req.params.id;
  const rows = await query('SELECT status, user_id FROM event_rsvps WHERE event_id = $1', [eventId]);
  const counts = { going: 0, maybe: 0, not_going: 0 };
  for (const r of rows) counts[r.status] += 1;
  const mine = rows.find((r) => r.user_id === req.user.id);
  res.json({ counts, myStatus: mine ? mine.status : null });
});

router.post('/:id/rsvp', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['going', 'maybe', 'not_going'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const rows = await query(
    `INSERT INTO event_rsvps (event_id, user_id, status)
     VALUES ($1,$2,$3)
     ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [req.params.id, req.user.id, status]
  );
  res.json({ rsvp: rows[0] });
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const eventsRoutes = require('./routes/events');
app.use('/api/events', eventsRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- events.test.js`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/events.js alumni-backend/src/server.js alumni-backend/tests/events.test.js
git commit -m "feat(backend): add events list/get/create/delete/rsvp routes"
```

---

### Task 8: Event registrations, check-in gate, and CSV export

**Files:**
- Modify: `alumni-backend/src/routes/events.js` — add routes below the existing ones, before `module.exports`
- Test: `alumni-backend/tests/event-registrations.test.js`

**Interfaces:**
- Consumes: `requireOfficer` (Task 3, new import into `events.js`), everything from Task 7.
- Produces (added to the same `/api/events` router): `GET /:id/registrations` (admin) → `{registrations: [{rsvp_id, alumni_id, full_name, email, batch_year, status, paid}]}`; `PATCH /:id/registrations/:alumniId` (admin) body `{paid}` → `200 {registration}`; `GET /:id/checkin` (auth) → `{attendance: [{id, full_name, batch_year, course, checked_in_at}]}`; `POST /:id/checkin` (officer: admin or `is_batch_leader`) body `{code}` → `201 {checkin}` or `403 {error}` if the resolved alumni hasn't RSVP'd `going` + `paid`; `GET /:id/export` (officer) → `200` with `Content-Type: text/csv` body of the attendance list.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/event-registrations.test.js`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- event-registrations.test.js`
Expected: FAIL (404 on the new routes)

- [ ] **Step 3: Modify `alumni-backend/src/routes/events.js`**

Change the import line at the top from:
```js
const { requireAuth, requireAdmin } = require('../middleware/auth');
```
to:
```js
const { requireAuth, requireAdmin, requireOfficer } = require('../middleware/auth');
```

Add these routes just before `module.exports = router;`:

```js
router.get('/:id/registrations', requireAuth, requireAdmin, async (req, res) => {
  const rows = await query(
    `SELECT r.id AS rsvp_id, r.user_id AS alumni_id, u.full_name, u.email, u.batch_year,
            r.status, r.paid
     FROM event_rsvps r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1
     ORDER BY u.full_name NULLS LAST`,
    [req.params.id]
  );
  res.json({ registrations: rows });
});

router.patch('/:id/registrations/:alumniId', requireAuth, requireAdmin, async (req, res) => {
  const { paid } = req.body;
  const rows = await query(
    `UPDATE event_rsvps SET paid = $1 WHERE event_id = $2 AND user_id = $3 RETURNING *`,
    [!!paid, req.params.id, req.params.alumniId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Registration not found' });
  res.json({ registration: rows[0] });
});

router.get('/:id/checkin', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT c.id, u.full_name, u.batch_year, u.course, c.checked_in_at
     FROM event_checkins c JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at ASC`,
    [req.params.id]
  );
  res.json({ attendance: rows });
});

async function resolveAlumniFromCode(code) {
  const match = /^ALUMNI:(\d+)$/.exec(code || '');
  if (match) {
    const rows = await query('SELECT * FROM users WHERE id = $1', [match[1]]);
    return rows[0] || null;
  }
  const rows = await query('SELECT * FROM users WHERE nfc_uid = $1', [code]);
  return rows[0] || null;
}

router.post('/:id/checkin', requireAuth, requireOfficer, async (req, res) => {
  const eventId = req.params.id;
  const alumni = await resolveAlumniFromCode(req.body.code);
  if (!alumni) return res.status(404).json({ error: 'Alumni not found for this code' });

  const rsvpRows = await query(
    'SELECT * FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
    [eventId, alumni.id]
  );
  const rsvp = rsvpRows[0];
  if (!rsvp || rsvp.status !== 'going' || !rsvp.paid) {
    return res.status(403).json({ error: 'Alumni must RSVP going and be marked paid before check-in' });
  }

  const rows = await query(
    `INSERT INTO event_checkins (event_id, user_id, checked_in_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (event_id, user_id) DO UPDATE SET checked_in_at = now()
     RETURNING *`,
    [eventId, alumni.id, req.user.id]
  );
  res.status(201).json({ checkin: rows[0] });
});

router.get('/:id/export', requireAuth, requireOfficer, async (req, res) => {
  const rows = await query(
    `SELECT u.full_name, u.batch_year, u.course, c.checked_in_at
     FROM event_checkins c JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at ASC`,
    [req.params.id]
  );
  const header = 'Name,Batch,Course,Checked In At\n';
  const body = rows
    .map((r) => `${r.full_name},${r.batch_year || ''},${r.course || ''},${r.checked_in_at.toISOString()}`)
    .join('\n');
  res.set('Content-Type', 'text/csv').send(header + body);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- event-registrations.test.js`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Run the full events suite together to check for regressions**

Run: `cd alumni-backend && npm test -- events.test.js event-registrations.test.js`
Expected: PASS (all tests from both files)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/events.js alumni-backend/tests/event-registrations.test.js
git commit -m "feat(backend): add event registrations, check-in gate, and CSV export"
```

---

### Task 9: Jobs routes

**Files:**
- Create: `alumni-backend/src/routes/jobs.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/jobs.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 3), `query` (Task 1).
- Produces: `routes/jobs.js` mounted at `/api/jobs`. `GET /?type=` (public, no auth) → `{jobs: [...]}` each row including `poster_name, poster_email, poster_pic, poster_role, poster_position` via JOIN on `users`. `POST /` (auth required) → `201 {job}`. `DELETE /:id` (auth required; allowed only if `req.user.role === 'admin'` or `req.user.id === job.posted_by`) → `204` or `403`.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/jobs.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

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

test('GET /api/jobs?type=internship filters by job_type', async () => {
  const poster = await insertUser();
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Job A', job_type: 'job' });
  await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Intern A', job_type: 'internship' });

  const res = await request(app).get('/api/jobs').query({ type: 'internship' });
  expect(res.body.jobs.length).toBe(1);
  expect(res.body.jobs[0].title).toBe('Intern A');
});

test('POST /api/jobs requires auth', async () => {
  const res = await request(app).post('/api/jobs').send({ title: 'No Auth Job' });
  expect(res.status).toBe(401);
});

test('DELETE /api/jobs/:id allowed for the original poster', async () => {
  const poster = await insertUser();
  const create = await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Mine' });
  const res = await request(app).delete(`/api/jobs/${create.body.job.id}`).set('Authorization', authHeader(poster));
  expect(res.status).toBe(204);
});

test('DELETE /api/jobs/:id rejected for a different non-admin user', async () => {
  const poster = await insertUser();
  const other = await insertUser();
  const create = await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Not Yours' });
  const res = await request(app).delete(`/api/jobs/${create.body.job.id}`).set('Authorization', authHeader(other));
  expect(res.status).toBe(403);
});

test('DELETE /api/jobs/:id allowed for admin regardless of poster', async () => {
  const poster = await insertUser();
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app).post('/api/jobs').set('Authorization', authHeader(poster)).send({ title: 'Admin Can Delete' });
  const res = await request(app).delete(`/api/jobs/${create.body.job.id}`).set('Authorization', authHeader(admin));
  expect(res.status).toBe(204);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- jobs.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/jobs.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const { type } = req.query;
  const conditions = [];
  const values = [];
  if (type) {
    values.push(type);
    conditions.push(`j.job_type = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(
    `SELECT j.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
            u.role AS poster_role, u.position AS poster_position
     FROM jobs j LEFT JOIN users u ON u.id = j.posted_by
     ${where}
     ORDER BY j.created_at DESC`,
    values
  );
  res.json({ jobs: rows });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, company, location, description, job_type, is_referral } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO jobs (title, company, location, description, job_type, is_referral, posted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title, company || null, location || null, description || null, job_type || 'job', !!is_referral, req.user.id]
  );
  res.status(201).json({ job: rows[0] });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Job not found' });
  const job = rows[0];
  if (req.user.role !== 'admin' && req.user.id !== job.posted_by) {
    return res.status(403).json({ error: 'Not allowed to delete this job' });
  }
  await query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const jobsRoutes = require('./routes/jobs');
app.use('/api/jobs', jobsRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- jobs.test.js`
Expected: PASS (all 6 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/jobs.js alumni-backend/src/server.js alumni-backend/tests/jobs.test.js
git commit -m "feat(backend): add jobs routes"
```

---

### Task 10: Announcements routes

**Files:**
- Create: `alumni-backend/src/routes/announcements.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/announcements.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `requireAdmin` (Task 3), `query` (Task 1).
- Produces: `routes/announcements.js` mounted at `/api/announcements`. `GET /` (public) → `{announcements: [...]}` with `poster_name, poster_email, poster_pic, poster_role, poster_position`. `POST /` (admin) → `201 {announcement}`. `DELETE /:id` (admin) → `204`.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/announcements.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/announcements is public', async () => {
  const res = await request(app).get('/api/announcements');
  expect(res.status).toBe(200);
  expect(res.body.announcements).toEqual([]);
});

test('POST /api/announcements requires admin', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(alumni))
    .send({ title: 'Hi', body: 'Not allowed' });
  expect(res.status).toBe(403);
});

test('admin can create and delete an announcement', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/announcements')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Welcome', body: 'Hello alumni!' });
  expect(create.status).toBe(201);
  expect(create.body.announcement.title).toBe('Welcome');

  const list = await request(app).get('/api/announcements');
  expect(list.body.announcements[0].poster_role).toBe('admin');

  const del = await request(app)
    .delete(`/api/announcements/${create.body.announcement.id}`)
    .set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- announcements.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/announcements.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT a.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
            u.role AS poster_role, u.position AS poster_position
     FROM announcements a LEFT JOIN users u ON u.id = a.posted_by
     ORDER BY a.created_at DESC`
  );
  res.json({ announcements: rows });
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO announcements (title, body, posted_by) VALUES ($1,$2,$3) RETURNING *`,
    [title, body || null, req.user.id]
  );
  res.status(201).json({ announcement: rows[0] });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const announcementsRoutes = require('./routes/announcements');
app.use('/api/announcements', announcementsRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- announcements.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/announcements.js alumni-backend/src/server.js alumni-backend/tests/announcements.test.js
git commit -m "feat(backend): add announcements routes"
```

---

### Task 11: Messages routes

**Files:**
- Create: `alumni-backend/src/routes/messages.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/messages.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 3), `query` (Task 1).
- Produces: `routes/messages.js` mounted at `/api/messages`. `GET /` → `{conversations: [{other_id, other_name, other_email, last_body, unread_count}]}`, one row per distinct conversation partner, newest last message first. `GET /:userId` → `{messages: [...], other: {id, full_name, email, batch_year, course}}`, and as a side effect marks all messages *from* `:userId` *to* the current user as read. `POST /` body `{receiver_id, body}` → `201 {message}`. (Socket.io emit is added in Task 16 — this task only persists to Postgres.)

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/messages.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('POST /api/messages sends a message', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  const res = await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(a))
    .send({ receiver_id: b.id, body: 'Hey Bob!' });
  expect(res.status).toBe(201);
  expect(res.body.message.body).toBe('Hey Bob!');
});

test('GET /api/messages lists conversations with last message and unread count', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  await request(app).post('/api/messages').set('Authorization', authHeader(a)).send({ receiver_id: b.id, body: 'First' });
  await request(app).post('/api/messages').set('Authorization', authHeader(a)).send({ receiver_id: b.id, body: 'Second' });

  const res = await request(app).get('/api/messages').set('Authorization', authHeader(b));
  expect(res.status).toBe(200);
  expect(res.body.conversations.length).toBe(1);
  expect(res.body.conversations[0].other_id).toBe(a.id);
  expect(res.body.conversations[0].last_body).toBe('Second');
  expect(res.body.conversations[0].unread_count).toBe(2);
});

test('GET /api/messages/:userId returns the thread and marks messages read', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  await request(app).post('/api/messages').set('Authorization', authHeader(a)).send({ receiver_id: b.id, body: 'Hi' });

  const thread = await request(app).get(`/api/messages/${a.id}`).set('Authorization', authHeader(b));
  expect(thread.status).toBe(200);
  expect(thread.body.messages.length).toBe(1);
  expect(thread.body.other.full_name).toBe('Alice');

  const convos = await request(app).get('/api/messages').set('Authorization', authHeader(b));
  expect(convos.body.conversations[0].unread_count).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- messages.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/messages.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const rows = await query(
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
});

router.get('/:userId', requireAuth, async (req, res) => {
  const otherId = req.params.userId;
  const otherRows = await query(
    'SELECT id, full_name, email, batch_year, course FROM users WHERE id = $1',
    [otherId]
  );
  if (otherRows.length === 0) return res.status(404).json({ error: 'User not found' });

  const messages = await query(
    `SELECT * FROM messages
     WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
     ORDER BY created_at ASC`,
    [req.user.id, otherId]
  );

  await query(
    `UPDATE messages SET read_at = now() WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL`,
    [otherId, req.user.id]
  );

  res.json({ messages, other: otherRows[0] });
});

router.post('/', requireAuth, async (req, res) => {
  const { receiver_id, body } = req.body;
  if (!receiver_id || !body) return res.status(400).json({ error: 'receiver_id and body are required' });
  const rows = await query(
    `INSERT INTO messages (sender_id, receiver_id, body) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.id, receiver_id, body]
  );
  res.status(201).json({ message: rows[0] });
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const messagesRoutes = require('./routes/messages');
app.use('/api/messages', messagesRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- messages.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/messages.js alumni-backend/src/server.js alumni-backend/tests/messages.test.js
git commit -m "feat(backend): add messages routes"
```

---

### Task 12: Groups routes

**Files:**
- Create: `alumni-backend/src/routes/groups.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/groups.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 3), `query` (Task 1).
- Produces: `routes/groups.js` mounted at `/api/groups`. `GET /` → `{groups: [{...group, member_count, is_member}]}`. `GET /:id` → `{group, members: [...], isMember}`. `GET /:id/posts` → `{posts: [{...post, author_name, author_email}]}`. `POST /` → `201 {group}` (creator is auto-joined as a member). `POST /:id/join` → `204`. `DELETE /:id/join` → `204`. `POST /:id/posts` → `201 {post}` only if the user is a member, else `403`.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/groups.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('POST /api/groups creates a group and auto-joins the creator', async () => {
  const user = await insertUser();
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', authHeader(user))
    .send({ name: 'Batch 2020', description: 'Our batch', kind: 'batch' });
  expect(res.status).toBe(201);

  const list = await request(app).get('/api/groups').set('Authorization', authHeader(user));
  const group = list.body.groups.find((g) => g.id === res.body.group.id);
  expect(group.member_count).toBe(1);
  expect(group.is_member).toBe(true);
});

test('join and leave a group', async () => {
  const creator = await insertUser();
  const joiner = await insertUser();
  const create = await request(app).post('/api/groups').set('Authorization', authHeader(creator)).send({ name: 'Mentors', kind: 'mentorship' });
  const groupId = create.body.group.id;

  const join = await request(app).post(`/api/groups/${groupId}/join`).set('Authorization', authHeader(joiner));
  expect(join.status).toBe(204);

  const detail = await request(app).get(`/api/groups/${groupId}`).set('Authorization', authHeader(joiner));
  expect(detail.body.isMember).toBe(true);
  expect(detail.body.members.length).toBe(2);

  const leave = await request(app).delete(`/api/groups/${groupId}/join`).set('Authorization', authHeader(joiner));
  expect(leave.status).toBe(204);

  const detail2 = await request(app).get(`/api/groups/${groupId}`).set('Authorization', authHeader(joiner));
  expect(detail2.body.isMember).toBe(false);
});

test('only members can post; posts include author name', async () => {
  const creator = await insertUser({ full_name: 'Creator Name' });
  const outsider = await insertUser();
  const create = await request(app).post('/api/groups').set('Authorization', authHeader(creator)).send({ name: 'Interest Club', kind: 'interest' });
  const groupId = create.body.group.id;

  const denied = await request(app)
    .post(`/api/groups/${groupId}/posts`)
    .set('Authorization', authHeader(outsider))
    .send({ body: 'Not a member' });
  expect(denied.status).toBe(403);

  const allowed = await request(app)
    .post(`/api/groups/${groupId}/posts`)
    .set('Authorization', authHeader(creator))
    .send({ body: 'Hello group' });
  expect(allowed.status).toBe(201);

  const posts = await request(app).get(`/api/groups/${groupId}/posts`).set('Authorization', authHeader(creator));
  expect(posts.body.posts[0].author_name).toBe('Creator Name');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- groups.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/groups.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT g.*,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS member_count,
            EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $1) AS is_member
     FROM groups g
     ORDER BY g.created_at DESC`,
    [req.user.id]
  );
  res.json({ groups: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const groupRows = await query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
  if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });

  const members = await query(
    `SELECT u.id, u.full_name, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1`,
    [req.params.id]
  );
  const isMember = members.some((m) => m.id === req.user.id);
  res.json({ group: groupRows[0], members, isMember });
});

router.get('/:id/posts', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT p.*, u.full_name AS author_name, u.email AS author_email
     FROM group_posts p JOIN users u ON u.id = p.author_id
     WHERE p.group_id = $1
     ORDER BY p.created_at ASC`,
    [req.params.id]
  );
  res.json({ posts: rows });
});

router.post('/', requireAuth, async (req, res) => {
  const { name, description, kind } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query(
    `INSERT INTO groups (name, description, kind, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, description || null, kind || 'interest', req.user.id]
  );
  const group = rows[0];
  await query(`INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)`, [group.id, req.user.id]);
  res.status(201).json({ group });
});

router.post('/:id/join', requireAuth, async (req, res) => {
  await query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.params.id, req.user.id]
  );
  res.status(204).end();
});

router.delete('/:id/join', requireAuth, async (req, res) => {
  await query(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  res.status(204).end();
});

router.post('/:id/posts', requireAuth, async (req, res) => {
  const membership = await query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'Must be a group member to post' });

  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });
  const rows = await query(
    `INSERT INTO group_posts (group_id, author_id, body) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, req.user.id, body]
  );
  res.status(201).json({ post: rows[0] });
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const groupsRoutes = require('./routes/groups');
app.use('/api/groups', groupsRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- groups.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/groups.js alumni-backend/src/server.js alumni-backend/tests/groups.test.js
git commit -m "feat(backend): add groups routes"
```

---

### Task 13: Notifications routes

**Files:**
- Create: `alumni-backend/src/routes/notifications.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/notifications.test.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 3), `query` (Task 1), `asyncHandler` (Task 12, `src/lib/asyncHandler.js` — wraps every async route handler so a rejected promise reaches the global error middleware in `server.js` instead of crashing the process; see Task 12's fix-round note in the ledger for why this exists).
- Produces: `routes/notifications.js` mounted at `/api`. `GET /notifications` → `{notifications: [...], unread: <int>}`. `PATCH /notifications` → `204`, marks all of the current user's notifications read. Also exports `createNotification({userId, type, title, body, link})` — a plain function (not a route) that Task 16 will call from other routes to insert notification rows and emit `notification:new`.

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/notifications.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');
const { createNotification } = require('../src/routes/notifications');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/notifications lists notifications and unread count', async () => {
  const user = await insertUser();
  await createNotification({ userId: user.id, type: 'info', title: 'Welcome', body: 'Hi there' });
  await createNotification({ userId: user.id, type: 'info', title: 'Second' });

  const res = await request(app).get('/api/notifications').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
  expect(res.body.notifications.length).toBe(2);
  expect(res.body.unread).toBe(2);
});

test('PATCH /api/notifications marks all as read', async () => {
  const user = await insertUser();
  await createNotification({ userId: user.id, type: 'info', title: 'One' });
  await createNotification({ userId: user.id, type: 'info', title: 'Two' });

  const patch = await request(app).patch('/api/notifications').set('Authorization', authHeader(user)).send({});
  expect(patch.status).toBe(204);

  const res = await request(app).get('/api/notifications').set('Authorization', authHeader(user));
  expect(res.body.unread).toBe(0);
});

test('createNotification inserts a row scoped to the given user', async () => {
  const user = await insertUser();
  const other = await insertUser();
  await createNotification({ userId: user.id, type: 'info', title: 'Only for user' });

  const rows = await query('SELECT * FROM notifications WHERE user_id = $1', [other.id]);
  expect(rows.length).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- notifications.test.js`
Expected: FAIL (404 / import error)

- [ ] **Step 3: Create `alumni-backend/src/routes/notifications.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/notifications', requireAuth, asyncHandler(async (req, res) => {
  const notifications = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const unread = notifications.filter((n) => !n.read_at).length;
  res.json({ notifications, unread });
}));

router.patch('/notifications', requireAuth, asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.status(204).end();
}));

async function createNotification({ userId, type, title, body, link }) {
  const rows = await query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, type, title, body || null, link || null]
  );
  return rows[0];
}

module.exports = router;
module.exports.createNotification = createNotification;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const notificationsRoutes = require('./routes/notifications');
app.use('/api', notificationsRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- notifications.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/notifications.js alumni-backend/src/server.js alumni-backend/tests/notifications.test.js
git commit -m "feat(backend): add notifications routes"
```

---

### Task 14: Admin users routes

**Files:**
- Create: `alumni-backend/src/routes/admin.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/admin.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `requireAdmin` (Task 3), `query` (Task 1), `asyncHandler` (Task 12, `src/lib/asyncHandler.js`).
- Produces: `routes/admin.js` mounted at `/api/admin`. All routes admin-only. `GET /users` → `{users: [...]}` (no `password_hash`). `PUT /users/:id` body any of `{role, active, is_batch_leader}` → `200 {user}`. `DELETE /users/:id` → `204`, or `400 {error}` if `req.params.id == req.user.id` (self-delete blocked server-side, matching the UI hiding that button but enforcing it for real).

- [ ] **Step 1: Write the failing tests — `alumni-backend/tests/admin.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/admin/users requires admin', async () => {
  const alumni = await insertUser();
  const res = await request(app).get('/api/admin/users').set('Authorization', authHeader(alumni));
  expect(res.status).toBe(403);
});

test('admin can list users, toggle role/active/is_batch_leader, and delete others', async () => {
  const admin = await insertUser({ role: 'admin' });
  const target = await insertUser({ role: 'alumni', active: true, is_batch_leader: false });

  const list = await request(app).get('/api/admin/users').set('Authorization', authHeader(admin));
  expect(list.status).toBe(200);
  expect(list.body.users.some((u) => u.id === target.id)).toBe(true);
  expect(list.body.users[0].password_hash).toBeUndefined();

  const promote = await request(app)
    .put(`/api/admin/users/${target.id}`)
    .set('Authorization', authHeader(admin))
    .send({ role: 'admin', is_batch_leader: true });
  expect(promote.status).toBe(200);
  expect(promote.body.user.role).toBe('admin');
  expect(promote.body.user.is_batch_leader).toBe(true);

  const deactivate = await request(app)
    .put(`/api/admin/users/${target.id}`)
    .set('Authorization', authHeader(admin))
    .send({ active: false });
  expect(deactivate.body.user.active).toBe(false);

  const del = await request(app).delete(`/api/admin/users/${target.id}`).set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);
});

test('admin cannot delete their own account', async () => {
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app).delete(`/api/admin/users/${admin.id}`).set('Authorization', authHeader(admin));
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npm test -- admin.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/admin.js`**

```js
const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/users', asyncHandler(async (req, res) => {
  const users = await query(
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
  const rows = await query(
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
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd alumni-backend && npm test -- admin.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/admin.js alumni-backend/src/server.js alumni-backend/tests/admin.test.js
git commit -m "feat(backend): add admin user management routes"
```

---

### Task 15: Stats route

**Files:**
- Create: `alumni-backend/src/routes/stats.js`
- Modify: `alumni-backend/src/server.js` — mount the router
- Test: `alumni-backend/tests/stats.test.js`

**Interfaces:**
- Consumes: `query` (Task 1), `asyncHandler` (Task 12, `src/lib/asyncHandler.js`). No auth (public, per `PublicHome.jsx` usage).
- Produces: `routes/stats.js` mounted at `/api`, route `GET /stats` → `200` with exactly the shape `Dashboard.jsx`/`PublicHome.jsx` consume: `{totalAlumni, totalEvents, totalCheckins, totalMessages, registrationsTrend: [{label, value}], checkinsTrend: [{label, value}], byBatch: [{label, value}], byIndustry: [{label, value}], eventsByMonth: [{label, value}], topCompanies: [{label, value}], byCourse: [{label, value}]}`. Trends cover the last 12 months, labelled `"Mon YYYY"` (e.g. `"Jan 2026"`), oldest first. `topCompanies` is limited to the top 8 by count.

- [ ] **Step 1: Write the failing test — `alumni-backend/tests/stats.test.js`**

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('GET /api/stats returns all expected aggregate shapes', async () => {
  const admin = await insertUser({ role: 'admin', batch_year: 2020, industry: 'Tech', company: 'Acme' });
  await insertUser({ batch_year: 2021, industry: 'Finance', company: 'Acme', course: 'BSIT' });
  await request(app)
    .post('/api/events')
    .set('Authorization', authHeader(admin))
    .send({ title: 'Event 1', event_date: new Date().toISOString() });

  const res = await request(app).get('/api/stats');
  expect(res.status).toBe(200);
  expect(res.body.totalAlumni).toBe(2);
  expect(res.body.totalEvents).toBe(1);
  expect(typeof res.body.totalCheckins).toBe('number');
  expect(typeof res.body.totalMessages).toBe('number');
  expect(Array.isArray(res.body.registrationsTrend)).toBe(true);
  expect(res.body.registrationsTrend.length).toBe(12);
  expect(Array.isArray(res.body.checkinsTrend)).toBe(true);
  expect(res.body.byBatch.some((b) => b.label === '2020')).toBe(true);
  expect(res.body.byIndustry.some((i) => i.label === 'Tech')).toBe(true);
  expect(res.body.topCompanies[0].label).toBe('Acme');
  expect(res.body.topCompanies[0].value).toBe(2);
  expect(res.body.byCourse.some((c) => c.label === 'BSIT')).toBe(true);
  expect(Array.isArray(res.body.eventsByMonth)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd alumni-backend && npm test -- stats.test.js`
Expected: FAIL (404)

- [ ] **Step 3: Create `alumni-backend/src/routes/stats.js`**

```js
const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

function monthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

async function monthlyTrend(table, dateColumn) {
  const rows = await query(
    `SELECT date_trunc('month', ${dateColumn}) AS month, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${dateColumn} >= now() - interval '12 months'
     GROUP BY month`
  );
  const byMonth = new Map(rows.map((r) => [r.month.toISOString().slice(0, 7), r.value]));

  const result = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 11);
  for (let i = 0; i < 12; i++) {
    const key = cursor.toISOString().slice(0, 7);
    result.push({ label: monthLabel(cursor), value: byMonth.get(key) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

async function groupCount(table, column, { limit } = {}) {
  const rows = await query(
    `SELECT ${column} AS label, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${column} IS NOT NULL
     GROUP BY ${column}
     ORDER BY value DESC
     ${limit ? `LIMIT ${limit}` : ''}`
  );
  return rows.map((r) => ({ label: String(r.label), value: r.value }));
}

router.get('/stats', asyncHandler(async (req, res) => {
  const [totalAlumni] = await query('SELECT COUNT(*)::int AS c FROM users');
  const [totalEvents] = await query('SELECT COUNT(*)::int AS c FROM events');
  const [totalCheckins] = await query('SELECT COUNT(*)::int AS c FROM event_checkins');
  const [totalMessages] = await query('SELECT COUNT(*)::int AS c FROM messages');

  const registrationsTrend = await monthlyTrend('users', 'created_at');
  const checkinsTrend = await monthlyTrend('event_checkins', 'checked_in_at');
  const eventsByMonthRaw = await monthlyTrend('events', 'event_date');

  const byBatch = await groupCount('users', 'batch_year');
  const byIndustry = await groupCount('users', 'industry');
  const byCourse = await groupCount('users', 'course');
  const topCompanies = await groupCount('users', 'company', { limit: 8 });

  res.json({
    totalAlumni: totalAlumni.c,
    totalEvents: totalEvents.c,
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
```

- [ ] **Step 4: Mount the router in `alumni-backend/src/server.js`**

```js
const statsRoutes = require('./routes/stats');
app.use('/api', statsRoutes);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd alumni-backend && npm test -- stats.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/stats.js alumni-backend/src/server.js alumni-backend/tests/stats.test.js
git commit -m "feat(backend): add stats aggregation route"
```

---

### Task 16: Socket.io real-time (messages + notifications)

**Files:**
- Create: `alumni-backend/src/lib/socket.js`
- Modify: `alumni-backend/src/server.js` — construct an `http.Server`, attach Socket.io, export `server` alongside `app`
- Modify: `alumni-backend/src/routes/messages.js` — emit `message:new` after insert
- Modify: `alumni-backend/src/routes/notifications.js` — emit `notification:new` from `createNotification`
- Test: `alumni-backend/tests/socket.test.js`

**Interfaces:**
- Produces: `lib/socket.js` → `{ initSocket(httpServer): SocketIOServer, emitToUser(userId, event, payload): void }`. `initSocket` attaches a Socket.io server to the given `http.Server`; on connection it reads `socket.handshake.auth.token`, verifies it with `verifyToken` (Task 3 `lib/token.js`), and joins the socket to room `` `user:${payload.id}` ``, or disconnects the socket if the token is missing/invalid. `emitToUser` emits `event` with `payload` to room `` `user:${userId}` `` — a no-op if `initSocket` was never called.
- Modifies: `server.js` now exports `{ app, server }` — `server` is an `http.Server` wrapping `app`, with Socket.io already attached via `initSocket(server)` at module load time (not gated behind `require.main`), so tests can call `server.listen(0)` themselves without needing to run the file as the entrypoint.

- [ ] **Step 1: Write the failing test — `alumni-backend/tests/socket.test.js`**

```js
const { io: ioClient } = require('socket.io-client');
const request = require('supertest');
const { app, server } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');
const { signToken } = require('../src/lib/token');
const { createNotification } = require('../src/routes/notifications');

let port;

beforeAll((done) => {
  server.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  pool.end().then(() => server.close(done));
});

beforeEach(() => resetDb());

function connectAs(user) {
  return ioClient(`http://localhost:${port}`, {
    auth: { token: signToken(user) },
    transports: ['websocket'],
  });
}

test('receiver gets a message:new event when a message is sent', async () => {
  const alice = await insertUser({ full_name: 'Alice' });
  const bob = await insertUser({ full_name: 'Bob' });

  const bobSocket = connectAs(bob);
  await new Promise((resolve) => bobSocket.on('connect', resolve));

  const received = new Promise((resolve) => bobSocket.on('message:new', resolve));

  await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(alice))
    .send({ receiver_id: bob.id, body: 'Hi Bob via socket' });

  const payload = await received;
  expect(payload.body).toBe('Hi Bob via socket');

  bobSocket.close();
});

test('createNotification emits a notification:new event to that user', async () => {
  const user = await insertUser();
  const userSocket = connectAs(user);
  await new Promise((resolve) => userSocket.on('connect', resolve));

  const received = new Promise((resolve) => userSocket.on('notification:new', resolve));
  await createNotification({ userId: user.id, type: 'info', title: 'Ping' });

  const payload = await received;
  expect(payload.title).toBe('Ping');

  userSocket.close();
});

test('a socket with an invalid token gets disconnected', async () => {
  const socket = ioClient(`http://localhost:${port}`, {
    auth: { token: 'not-a-real-token' },
    transports: ['websocket'],
  });
  const disconnected = new Promise((resolve) => socket.on('disconnect', resolve));
  await disconnected;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd alumni-backend && npm test -- socket.test.js`
Expected: FAIL (`server` is undefined from `../src/server`, and `socket.io-client` events never fire)

- [ ] **Step 3: Create `alumni-backend/src/lib/socket.js`**

```js
const { Server } = require('socket.io');
const { verifyToken } = require('./token');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });
  io.on('connection', (socket) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    try {
      const payload = verifyToken(token);
      socket.join(`user:${payload.id}`);
    } catch {
      socket.disconnect(true);
    }
  });
  return io;
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initSocket, emitToUser };
```

- [ ] **Step 4: Modify `alumni-backend/src/server.js`**

Replace the `if (require.main === module) { ... }` block and the final `module.exports` line with:

```js
const http = require('http');
const { initSocket } = require('./lib/socket');

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`alumni-backend listening on port ${PORT}`);
  });
}

module.exports = { app, server };
```

- [ ] **Step 5: Modify `alumni-backend/src/routes/messages.js`**

Add the import near the top:
```js
const { emitToUser } = require('../lib/socket');
```

The already-implemented `POST /` handler wraps its body in `try { ... } catch (err) { ... }` (added in Task 11) — **keep that wrapper**, only insert the emit call inside the `try` block, right after the insert and before the response:

```js
router.post('/', requireAuth, async (req, res) => {
  try {
    const { receiver_id, body } = req.body;
    if (!receiver_id || !body) return res.status(400).json({ error: 'receiver_id and body are required' });
    const rows = await query(
      `INSERT INTO messages (sender_id, receiver_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, receiver_id, body]
    );
    const message = rows[0];
    emitToUser(receiver_id, 'message:new', message);
    res.status(201).json({ message: message });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 6: Modify `alumni-backend/src/routes/notifications.js`**

Add the import near the top:
```js
const { emitToUser } = require('../lib/socket');
```

Change `createNotification` to emit after inserting:
```js
async function createNotification({ userId, type, title, body, link }) {
  const rows = await query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, type, title, body || null, link || null]
  );
  const notification = rows[0];
  emitToUser(userId, 'notification:new', notification);
  return notification;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd alumni-backend && npm test -- socket.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 8: Run the entire backend test suite to check for regressions**

Run: `cd alumni-backend && npm test`
Expected: PASS — every test file from Tasks 1–16 passes together.

- [ ] **Step 9: Commit**

```bash
git add alumni-backend/src/lib/socket.js alumni-backend/src/server.js alumni-backend/src/routes/messages.js alumni-backend/src/routes/notifications.js alumni-backend/tests/socket.test.js
git commit -m "feat(backend): add Socket.io real-time for messages and notifications"
```

---

### Task 17: Seed script

**Files:**
- Create: `alumni-backend/db/seed.js`
- Test: `alumni-backend/tests/seed.test.js`

**Interfaces:**
- Consumes: `hashPassword` (Task 3 `lib/password.js`), `pool` (Task 1 `db.js`).
- Produces: `db/seed.js` exports `async function seed(pool)` (idempotent — safe to run twice, uses `ON CONFLICT (email) DO NOTHING` for users) that inserts: 1 admin (`admin@alumni.local` / `admin123`), 4 sample alumni (varied `batch_year`, `course`, `industry`, `company`, one with `mentor_available: true`, one with `is_batch_leader: true`), 2 sample events (one past, one upcoming), 2 sample jobs, 1 sample announcement. Running the file directly (`node db/seed.js`) calls `seed(pool)` against `DATABASE_URL` and logs the admin credentials to the console.

- [ ] **Step 1: Write the failing test — `alumni-backend/tests/seed.test.js`**

```js
const { pool, query } = require('../src/db');
const { seed } = require('../db/seed');
const { resetDb } = require('./helpers');

afterAll(() => pool.end());
beforeEach(() => resetDb());

test('seed creates the default admin and sample data', async () => {
  await seed(pool);

  const admins = await query(`SELECT * FROM users WHERE email = 'admin@alumni.local'`);
  expect(admins.length).toBe(1);
  expect(admins[0].role).toBe('admin');

  const alumni = await query(`SELECT * FROM users WHERE role = 'alumni'`);
  expect(alumni.length).toBeGreaterThanOrEqual(4);

  const events = await query('SELECT * FROM events');
  expect(events.length).toBeGreaterThanOrEqual(2);

  const jobs = await query('SELECT * FROM jobs');
  expect(jobs.length).toBeGreaterThanOrEqual(2);

  const announcements = await query('SELECT * FROM announcements');
  expect(announcements.length).toBeGreaterThanOrEqual(1);
});

test('seed is idempotent — running twice does not duplicate the admin', async () => {
  await seed(pool);
  await seed(pool);
  const admins = await query(`SELECT * FROM users WHERE email = 'admin@alumni.local'`);
  expect(admins.length).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd alumni-backend && npm test -- seed.test.js`
Expected: FAIL (`db/seed.js` doesn't export `seed` yet)

- [ ] **Step 3: Create `alumni-backend/db/seed.js`**

```js
require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword } = require('../src/lib/password');

async function seed(pool) {
  const adminHash = await hashPassword('admin123');
  const adminRows = await pool.query(
    `INSERT INTO users (email, password_hash, role, full_name, batch_year, course)
     VALUES ('admin@alumni.local', $1, 'admin', 'System Admin', 2015, 'BSCS')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [adminHash]
  );

  const sampleHash = await hashPassword('password123');
  const alumniData = [
    ['ana.reyes@alumni.local', 'Ana Reyes', 2019, 'BSIT', 'Tech', 'Globex Inc', 'Software Engineer', false, false],
    ['mark.cruz@alumni.local', 'Mark Cruz', 2018, 'BSCS', 'Finance', 'FinCorp', 'Analyst', true, false],
    ['liza.santos@alumni.local', 'Liza Santos', 2020, 'BSIT', 'Tech', 'Globex Inc', 'Product Manager', false, true],
    ['jon.dela.cruz@alumni.local', 'Jon Dela Cruz', 2017, 'BSCE', 'Construction', 'BuildRight', 'Civil Engineer', false, false],
  ];
  for (const [email, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader] of alumniData) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader)
       VALUES ($1,$2,'alumni',$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (email) DO NOTHING`,
      [email, sampleHash, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader]
    );
  }

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
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  seed(pool)
    .then(() => {
      console.log('Seed complete. Default admin login: admin@alumni.local / admin123');
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd alumni-backend && npm test -- seed.test.js`
Expected: PASS (both tests)

- [ ] **Step 5: Seed the real dev database**

Run: `cd alumni-backend && npm run seed`
Expected: prints `Seed complete. Default admin login: admin@alumni.local / admin123`

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/db/seed.js alumni-backend/tests/seed.test.js
git commit -m "feat(backend): add seed script with default admin and sample data"
```

---

### Task 18: Frontend Socket.io wiring

**Files:**
- Modify: `alumni-frontend/package.json` — add `socket.io-client`
- Create: `alumni-frontend/src/socket.js`
- Modify: `alumni-frontend/src/auth.jsx` — connect/disconnect the socket alongside login state
- Modify: `alumni-frontend/src/pages/Messages.jsx` — refetch on `message:new`
- Modify: `alumni-frontend/src/pages/Notifications.jsx` — refetch on `notification:new`

**Interfaces:**
- Consumes: backend Socket.io server from Task 16 (events `message:new`, `notification:new`, handshake `auth: {token}`).
- Produces: `src/socket.js` exports `{ connectSocket(token): Socket, getSocket(): Socket|null, disconnectSocket(): void }`.

**Note on testing:** `alumni-frontend` has no test runner configured (`package.json` only has `dev/build/lint/preview` scripts) and this plan does not introduce one — that would be new tooling well beyond "wire up the socket client," which the design explicitly scoped as a minimal touch. Verification for this task is manual, via two browser sessions against the running dev stack.

- [ ] **Step 1: Add the dependency**

Run: `cd alumni-frontend && npm install socket.io-client`
Expected: added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `alumni-frontend/src/socket.js`**

```js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

let socket = null;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(SOCKET_URL, { auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

- [ ] **Step 3: Modify `alumni-frontend/src/auth.jsx`**

Add the import at the top:
```js
import { connectSocket, disconnectSocket } from './socket';
```

In the `useEffect` that runs on mount, connect the socket if a token is already stored:
```js
useEffect(() => {
  const stored = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  if (stored) {
    setUser(JSON.parse(stored));
    refresh();
  }
  if (token) connectSocket(token);
  setLoading(false);
}, []);
```

In `login`, connect right after storing the token (add the line after `localStorage.setItem('token', data.token);`):
```js
connectSocket(data.token);
```

Do the same in `register`, right after its `localStorage.setItem('token', data.token);` line.

In `logout`, disconnect the socket:
```js
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  disconnectSocket();
  setUser(null);
};
```

- [ ] **Step 4: Modify `alumni-frontend/src/pages/Messages.jsx`**

Add the import at the top:
```js
import { getSocket } from '../socket';
```

Add a new `useEffect` (alongside the existing ones) that listens for incoming messages and refetches whichever view is relevant:
```js
useEffect(() => {
  const socket = getSocket();
  if (!socket) return;
  const onNewMessage = (message) => {
    loadConvos();
    if (active && (message.sender_id === active || message.receiver_id === active)) {
      openThread(active);
    }
  };
  socket.on('message:new', onNewMessage);
  return () => socket.off('message:new', onNewMessage);
}, [active]);
```

- [ ] **Step 5: Modify `alumni-frontend/src/pages/Notifications.jsx`**

Add the import at the top:
```js
import { getSocket } from '../socket';
```

Add a new `useEffect` that refetches on a new notification:
```js
useEffect(() => {
  const socket = getSocket();
  if (!socket) return;
  const onNewNotification = () => load();
  socket.on('notification:new', onNewNotification);
  return () => socket.off('notification:new', onNewNotification);
}, []);
```

- [ ] **Step 6: Manual verification**

With both `alumni-backend` (`npm run dev`, port 4000) and `alumni-frontend` (`npm run dev`, port 5173) running:
1. Log in as two different users in two separate browser windows (e.g. one normal, one incognito).
2. In window A, go to Messages, start a conversation with the user from window B, and send a message.
3. In window B, confirm the conversation list updates (and the thread, if already open) without a manual page refresh.
4. Trigger a notification (e.g. have an admin post an announcement, if that's wired to `createNotification` — otherwise call `createNotification` directly via a quick Node REPL against the running backend to confirm the event fires) and confirm window B's Notifications page updates live.

- [ ] **Step 7: Commit**

```bash
git add alumni-frontend/package.json alumni-frontend/package-lock.json alumni-frontend/src/socket.js alumni-frontend/src/auth.jsx alumni-frontend/src/pages/Messages.jsx alumni-frontend/src/pages/Notifications.jsx
git commit -m "feat(frontend): wire up Socket.io client for live messages and notifications"
```

---

### Task 19: README + full-stack smoke test

**Files:**
- Create: `alumni-backend/README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–18. This task adds no new code — it documents setup and proves the two halves of the app work together end-to-end.

- [ ] **Step 1: Create `alumni-backend/README.md`**

```markdown
# Alumni Backend

Node/Express + PostgreSQL API for `alumni-frontend`.

## Setup

1. Copy `.env.example` to `.env` and adjust if your local PostgreSQL differs from
   `postgres://postgres:123@localhost:8000` (this project's Postgres runs on port
   **8000**, not the default 5432 — check with `Get-NetTCPConnection -State Listen`
   if unsure).
2. Create the databases (one-time):
   ```
   PGPASSWORD=123 psql -U postgres -h localhost -p 8000 -c "CREATE DATABASE alumni;"
   PGPASSWORD=123 psql -U postgres -h localhost -p 8000 -c "CREATE DATABASE alumni_test;"
   ```
3. Install dependencies: `npm install`
4. Apply the schema: `npm run migrate`
5. Seed sample data: `npm run seed` (creates admin login `admin@alumni.local` / `admin123`)
6. Start the dev server: `npm run dev` (listens on port 4000)

## Testing

`npm test` runs the full Jest + Supertest suite against the `alumni_test` database
(run `npm run migrate:test` first if you haven't already).

## Frontend

`alumni-frontend`'s Vite dev server proxies `/api` to `http://localhost:4000` — no
extra configuration needed there. Socket.io connects directly to
`http://localhost:4000` (see `alumni-frontend/src/socket.js`).
```

- [ ] **Step 2: Run the full backend test suite one more time**

Run: `cd alumni-backend && npm test`
Expected: PASS — every test file passes.

- [ ] **Step 3: Full-stack manual smoke test**

1. `cd alumni-backend && npm run migrate && npm run seed && npm run dev` (leave running)
2. In a second terminal: `cd alumni-frontend && npm run dev` (leave running)
3. Open `http://localhost:5173` in a browser.
4. Log in with `admin@alumni.local` / `admin123`.
5. Confirm the Dashboard loads real numbers (not zeros/errors) — this proves `/api/stats` is reachable through the Vite proxy.
6. Visit Directory, Events, Jobs, Announcements, Groups — confirm the seeded sample data renders.
7. Log out, register a brand-new account, confirm it lands on the Dashboard as role `alumni` (no admin-only nav items visible).

- [ ] **Step 4: Commit**

```bash
git add alumni-backend/README.md
git commit -m "docs(backend): add setup and testing README"
```

---

## Self-Review Notes

- **Spec coverage:** every route in the design spec's "API Surface" section maps to a task (Tasks 4–15), auth/real-time/scripts are covered (Tasks 3, 16, 17), and the frontend Socket.io touch is covered (Task 18). The one spec item intentionally *not* built is the QR camera-scanning UI — the spec explicitly calls this out as future frontend work, not part of this plan.
- **Placeholder scan:** no TODOs/TBDs; every step has runnable code and exact commands.
- **Type/name consistency:** `query()` returns `rows[]` everywhere (Task 1's contract is used identically in Tasks 4–17); `requireAuth`/`requireAdmin`/`requireOfficer` names match between their definition (Task 3) and every later import; `emitToUser(userId, event, payload)` signature (Task 16) matches its two call sites (`messages.js`, `notifications.js`); `resetDb`/`insertUser`/`authHeader` (Task 3) are used with the same signatures in every subsequent test file.
