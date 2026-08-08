# Registration Fee Payment (PayMongo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New alumni/guest accounts pay a registration fee via PayMongo before their account is created; existing accounts pay again every 2 years or get fully blocked until they renew.

**Architecture:** PayMongo Checkout Sessions (hosted payment page) carry the pending-registration data in `metadata`; the account itself is only created when PayMongo's webhook confirms payment. A per-user `registration_paid_until` timestamp drives a full-block gate in `requireAuth`, mirroring the existing school-level `trialExpired` gate. Admin controls a per-school `registration_open` toggle and `registration_fee` amount.

**Tech Stack:** Node's built-in `fetch` (no PayMongo SDK exists) for REST calls to `api.paymongo.com`, Node's built-in `crypto` for webhook signature verification, Jest + Supertest for backend tests, React (Vite) + existing UI primitives for frontend.

## Global Constraints

- `registration_fee` is stored in **centavos** everywhere in the backend (₱200.00 = `20000`) — only the frontend converts to/from pesos for display and input.
- Never call PayMongo's real API from a test — `paymongo.js` must be required as a whole module (`const paymongo = require('../lib/paymongo')`) and called as `paymongo.createCheckoutSession(...)` at the call site (not destructured at require-time), so `jest.spyOn(paymongo, 'createCheckoutSession')` can mock it, matching the existing pattern already used for `ai.generateReply` in `alumni-backend/src/routes/chat.js`.
- The webhook signature algorithm implemented in Task 2 is a best-effort implementation based on PayMongo's documented header name (`Paymongo-Signature`) and the industry-standard HMAC scheme their docs allude to but don't fully spell out. **Task 6 has a mandatory manual step that sends a real webhook from the PayMongo dashboard and confirms it actually verifies — do not skip this and do not consider the webhook route done until that step passes.**
- Follow existing patterns: raw SQL via `req.db`/`queryForSchool`/`query` (no ORM), `asyncHandler` wrapping every route handler, brutalist UI tokens (`var(--brand-ink)` etc.) and the existing `Panel`/`Button`/`Input`/`Badge` primitives for all new frontend UI — no new UI primitives needed.
- This repo has no frontend test framework — frontend tasks are verified via `eslint` + `vite build` + manual/Playwright browser checks, not Jest.

---

### Task 1: Schema changes and backfill

**Files:**
- Modify: `alumni-backend/db/schema.sql`

**Interfaces:**
- Produces: `schools.registration_open` (boolean, default true), `schools.registration_fee` (integer centavos, default 0), `users.registration_paid_until` (timestamptz, nullable at the column level but never NULL in practice after the backfill), `users.paymongo_checkout_session_id` (text, nullable), and a new `processed_webhook_events` table used purely for webhook idempotency (no RLS — internal ledger, not tenant data).

- [ ] **Step 1: Add the columns and backfill table**

At the end of `alumni-backend/db/schema.sql`, after the existing `platform_admins`/`alumni_platform` grants block, add:

```sql
ALTER TABLE schools ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS registration_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_paid_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paymongo_checkout_session_id TEXT;

UPDATE users SET registration_paid_until = now() + interval '2 years' WHERE registration_paid_until IS NULL;

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Migrate dev and test databases**

Run (from `alumni-backend/`):
```bash
npm run migrate
npm run migrate:test
```
Expected: both print "Migration complete." with no errors.

- [ ] **Step 3: Verify the backfill ran**

Run a one-off check (from `alumni-backend/`, adjust connection string if needed):
```bash
node -e "require('./src/db').query('SELECT count(*) FROM users WHERE registration_paid_until IS NULL').then(r => console.log(r))"
```
Expected: `count` is `0` — no existing user was left with a NULL `registration_paid_until`.

- [ ] **Step 4: Add the new table to `resetDb()`'s TRUNCATE list**

`processed_webhook_events` is a new table and must be truncated between tests, otherwise webhook-idempotency test data leaks across test runs (this bit a previous feature in this codebase before — always add new tables here). In `alumni-backend/tests/helpers.js`, update the `TRUNCATE TABLE` list inside `resetDb()`:

```js
async function resetDb() {
  defaultSchool = null;
  await pool.query(`
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_checkins, event_rsvps, events, users, schools, platform_admins,
      processed_webhook_events
    RESTART IDENTITY CASCADE
  `);
}
```

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/tests/helpers.js
git commit -m "feat(backend): add registration fee/expiry schema, grandfather existing users"
```

---

### Task 2: PayMongo client library

**Files:**
- Create: `alumni-backend/src/lib/paymongo.js`
- Test: `alumni-backend/tests/paymongo.test.js`
- Modify: `alumni-backend/.env.example`, `alumni-backend/.env` (already has real test keys from this conversation)

**Interfaces:**
- Consumes: `process.env.PAYMONGO_SECRET_KEY` (required for `createCheckoutSession` to make a real call).
- Produces: `createCheckoutSession({ lineItems, paymentMethodTypes, successUrl, cancelUrl, metadata, referenceNumber })` → `Promise<{ id, checkoutUrl }>`. `verifyWebhookSignature(rawBody, signatureHeader, secret)` → `boolean`, pure/synchronous, no network call — takes the secret as a parameter (not read from env internally) specifically so tests can pass a known test secret.

- [ ] **Step 1: Write the failing signature-verification tests (pure function, no mocking needed)**

Create `alumni-backend/tests/paymongo.test.js`:

```js
const crypto = require('crypto');
const { verifyWebhookSignature } = require('../src/lib/paymongo');

function signPayload(rawBody, secret, timestamp) {
  const signedPayload = `${timestamp}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
}

test('verifyWebhookSignature accepts a correctly signed test-mode payload', () => {
  const secret = 'whsk_test_secret';
  const rawBody = JSON.stringify({ data: { id: 'evt_1' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = signPayload(rawBody, secret, timestamp);
  const header = `t=${timestamp},te=${te},li=deadbeef`;

  expect(verifyWebhookSignature(rawBody, header, secret)).toBe(true);
});

test('verifyWebhookSignature rejects a payload signed with the wrong secret', () => {
  const rawBody = JSON.stringify({ data: { id: 'evt_1' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = signPayload(rawBody, 'wrong-secret', timestamp);
  const header = `t=${timestamp},te=${te},li=deadbeef`;

  expect(verifyWebhookSignature(rawBody, header, 'whsk_test_secret')).toBe(false);
});

test('verifyWebhookSignature rejects a tampered body', () => {
  const secret = 'whsk_test_secret';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = signPayload(JSON.stringify({ data: { id: 'evt_1' } }), secret, timestamp);
  const header = `t=${timestamp},te=${te},li=deadbeef`;
  const tamperedBody = JSON.stringify({ data: { id: 'evt_2' } });

  expect(verifyWebhookSignature(tamperedBody, header, secret)).toBe(false);
});

test('verifyWebhookSignature rejects a missing header', () => {
  expect(verifyWebhookSignature('{}', undefined, 'whsk_test_secret')).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/paymongo.test.js --runInBand`
Expected: FAIL — `../src/lib/paymongo` doesn't exist yet.

- [ ] **Step 3: Implement `paymongo.js`**

Create `alumni-backend/src/lib/paymongo.js`:

```js
const crypto = require('crypto');

const API_BASE = 'https://api.paymongo.com/v1';

async function createCheckoutSession({ lineItems, paymentMethodTypes, successUrl, cancelUrl, metadata, referenceNumber }) {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYMONGO_SECRET_KEY is not set');
  }

  const res = await fetch(`${API_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: paymentMethodTypes,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata,
          reference_number: referenceNumber,
        },
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    const message = body?.errors?.[0]?.detail || 'PayMongo checkout session creation failed';
    throw new Error(message);
  }

  return { id: body.data.id, checkoutUrl: body.data.attributes.checkout_url };
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parts = {};
  for (const kv of signatureHeader.split(',')) {
    const [key, value] = kv.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }
  const { t: timestamp, te, li } = parts;
  if (!timestamp) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  const matches = (candidate) => {
    if (!candidate) return false;
    const candidateBuf = Buffer.from(candidate, 'hex');
    return candidateBuf.length === expectedBuf.length && crypto.timingSafeEqual(candidateBuf, expectedBuf);
  };

  return matches(te) || matches(li);
}

module.exports = { createCheckoutSession, verifyWebhookSignature };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/paymongo.test.js --runInBand`
Expected: all 4 tests PASS.

- [ ] **Step 5: Document the env vars**

Add to `alumni-backend/.env.example` (after the existing `OPENAI_MODEL=gpt-4o-mini` line):

```
# Required for the registration-fee payment feature. Test-mode keys work
# without a fully verified PayMongo business account.
PAYMONGO_SECRET_KEY=
PAYMONGO_PUBLIC_KEY=
# Generated in PayMongo Dashboard > Developers > Webhooks after registering
# the /api/payments/webhook endpoint (Task 6).
PAYMONGO_WEBHOOK_SECRET=
```

`alumni-backend/.env` already has `PAYMONGO_SECRET_KEY` and `PAYMONGO_PUBLIC_KEY` set from earlier in this session — leave `PAYMONGO_WEBHOOK_SECRET` blank there until Task 6's manual webhook-registration step.

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/lib/paymongo.js alumni-backend/tests/paymongo.test.js alumni-backend/.env.example
git commit -m "feat(backend): add PayMongo checkout session and webhook signature verification"
```

---

### Task 3: Admin registration settings (`registration_open`, `registration_fee`)

**Files:**
- Modify: `alumni-backend/src/routes/school.js`
- Modify: `alumni-backend/src/routes/admin.js`
- Test: `alumni-backend/tests/admin.test.js`

**Interfaces:**
- Produces: `GET /api/school` now also returns `registration_open` and `registration_fee`. `PATCH /api/admin/school` (`requireAdmin`) accepts `{ registration_open?: boolean, registration_fee?: number }`, updates `req.school`'s row, returns `{ school }`.

- [ ] **Step 1: Write the failing tests**

Add to `alumni-backend/tests/admin.test.js` (after the existing tests, before the final closing of the file):

```js
test('GET /api/school includes registration_open and registration_fee', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/school').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.registration_open).toBe(true);
  expect(res.body.registration_fee).toBe(0);
});

test('PATCH /api/admin/school requires admin', async () => {
  const school = await getDefaultSchool();
  const alumni = await insertUser();
  const res = await request(app)
    .patch('/api/admin/school')
    .set('Host', hostFor(school))
    .set('Authorization', authHeader(alumni))
    .send({ registration_fee: 20000 });
  expect(res.status).toBe(403);
});

test('admin can update registration_open and registration_fee', async () => {
  const school = await getDefaultSchool();
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app)
    .patch('/api/admin/school')
    .set('Host', hostFor(school))
    .set('Authorization', authHeader(admin))
    .send({ registration_open: false, registration_fee: 20000 });
  expect(res.status).toBe(200);
  expect(res.body.school.registration_open).toBe(false);
  expect(res.body.school.registration_fee).toBe(20000);
});
```

`getDefaultSchool` and `hostFor` are already imported in `admin.test.js` from `./helpers` (confirm the import line includes them; add if missing).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/admin.test.js --runInBand`
Expected: FAIL — `registration_open`/`registration_fee` are undefined in the `GET /api/school` response, and `PATCH /api/admin/school` doesn't exist (404).

- [ ] **Step 3: Update `school.js`**

Replace the full contents of `alumni-backend/src/routes/school.js`:

```js
const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/school', asyncHandler(async (req, res) => {
  res.json({
    name: req.school.name,
    logo: req.school.logo,
    registration_open: req.school.registration_open,
    registration_fee: req.school.registration_fee,
  });
}));

module.exports = router;
```

- [ ] **Step 4: Add `registration_open`/`registration_fee` to `resolveTenant`'s school SELECTs**

In `alumni-backend/src/middleware/tenant.js`, both `SELECT id, slug, name, logo, plan, trial_ends_at, active FROM schools ...` queries (one by slug, one by id) need `registration_open, registration_fee` added to the column list, so `req.school` carries them:

```js
const bySlug = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active, registration_open, registration_fee FROM schools WHERE slug = $1', [slug]);
```
```js
const byId = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active, registration_open, registration_fee FROM schools WHERE id = $1', [payload.school_id]);
```

- [ ] **Step 5: Add the `PATCH /api/admin/school` route**

In `alumni-backend/src/routes/admin.js`, add after the existing `router.use(requireAuth, requireAdmin);` line (before `router.get('/users', ...)`):

```js
router.patch('/school', asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ['registration_open', 'registration_fee']) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  const rows = await req.db(
    `UPDATE schools SET ${setClause} WHERE id = $${columns.length + 1} RETURNING id, slug, name, registration_open, registration_fee`,
    [...values, req.school.id]
  );
  res.json({ school: rows[0] });
}));
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/admin.test.js --runInBand`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add alumni-backend/src/routes/school.js alumni-backend/src/routes/admin.js alumni-backend/src/middleware/tenant.js alumni-backend/tests/admin.test.js
git commit -m "feat(backend): expose and let admin configure registration_open/registration_fee"
```

---

### Task 4: Signup and renewal checkout routes

**Files:**
- Create: `alumni-backend/src/routes/registration.js`
- Modify: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/registration.test.js`

**Interfaces:**
- Consumes: `paymongo.createCheckoutSession` (Task 2, mocked in tests via `jest.spyOn`), `req.db`, `req.school`, `req.user` (from `requireAuth`), `hashPassword` from `../lib/password`.
- Produces: `POST /api/registration/signup-checkout` (public), `GET /api/registration/signup-checkout/:sessionId/status` (public), `POST /api/registration/renew-checkout` (`requireAuth`).

- [ ] **Step 1: Write the failing tests**

Create `alumni-backend/tests/registration.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, hostFor, authHeader } = require('./helpers');
const paymongo = require('../src/lib/paymongo');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));
afterEach(() => jest.restoreAllMocks());

test('POST /api/registration/signup-checkout rejects when registration is closed', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_open = false WHERE id = $1', [school.id]);

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person' });

  expect(res.status).toBe(400);
});

test('POST /api/registration/signup-checkout rejects when no fee is configured', async () => {
  const school = await getDefaultSchool();

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person' });

  expect(res.status).toBe(400);
});

test('POST /api/registration/signup-checkout creates a checkout session and returns its URL', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_test123', checkoutUrl: 'https://checkout.paymongo.com/cs_test123' });

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person', member_type: 'guest' });

  expect(res.status).toBe(200);
  expect(res.body.checkoutUrl).toBe('https://checkout.paymongo.com/cs_test123');
  expect(paymongo.createCheckoutSession).toHaveBeenCalledTimes(1);
  const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
  expect(callArgs.lineItems[0].amount).toBe(20000);
  expect(callArgs.metadata.kind).toBe('signup');
  expect(callArgs.metadata.email).toBe('new@test.com');
  expect(callArgs.metadata.member_type).toBe('guest');
  expect(callArgs.metadata.password_hash).toBeTruthy();
  expect(callArgs.metadata.password_hash).not.toBe('secret123');
});

test('POST /api/registration/signup-checkout rejects a duplicate email', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  await insertUser({ email: 'dupe@test.com' });

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'dupe@test.com', password: 'secret123', full_name: 'Dupe' });

  expect(res.status).toBe(409);
});

test('GET /api/registration/signup-checkout/:sessionId/status returns not-ready before the webhook fires', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .get('/api/registration/signup-checkout/cs_nonexistent/status')
    .set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.ready).toBe(false);
});

test('GET /api/registration/signup-checkout/:sessionId/status returns a token once the user exists', async () => {
  const school = await getDefaultSchool();
  const user = await insertUser({ paymongo_checkout_session_id: 'cs_done123' });

  const res = await request(app)
    .get('/api/registration/signup-checkout/cs_done123/status')
    .set('Host', hostFor(school));

  expect(res.status).toBe(200);
  expect(res.body.ready).toBe(true);
  expect(res.body.token).toBeTruthy();
  expect(res.body.user.id).toBe(user.id);
});

test('POST /api/registration/renew-checkout requires auth', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/registration/renew-checkout')
    .set('Host', hostFor(school));
  expect(res.status).toBe(401);
});

test('POST /api/registration/renew-checkout creates a renewal checkout session', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  const user = await insertUser();
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_renew1', checkoutUrl: 'https://checkout.paymongo.com/cs_renew1' });

  const res = await request(app)
    .post('/api/registration/renew-checkout')
    .set('Host', hostFor(school))
    .set('Authorization', authHeader(user));

  expect(res.status).toBe(200);
  expect(res.body.checkoutUrl).toBe('https://checkout.paymongo.com/cs_renew1');
  const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
  expect(callArgs.metadata.kind).toBe('renewal');
  expect(callArgs.metadata.user_id).toBe(String(user.id));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/registration.test.js --runInBand`
Expected: FAIL — the route file doesn't exist yet (all requests 404).

- [ ] **Step 3: Create `registration.js`**

Create `alumni-backend/src/routes/registration.js`:

```js
const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { hashPassword } = require('../lib/password');
const { signToken } = require('../lib/token');
const { requireAuth } = require('../middleware/auth');
const paymongo = require('../lib/paymongo');

const router = express.Router();

router.post('/signup-checkout', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, contact, address, member_type } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  if (!req.school.registration_open) {
    return res.status(400).json({ error: 'Registration is currently closed' });
  }
  if (!req.school.registration_fee || req.school.registration_fee <= 0) {
    return res.status(400).json({ error: 'Registration fee has not been configured yet' });
  }

  const resolvedMemberType = member_type || 'alumnus';
  if (!['alumnus', 'guest'].includes(resolvedMemberType)) {
    return res.status(400).json({ error: 'member_type must be alumnus or guest' });
  }

  const existing = await req.db('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await hashPassword(password);

  const session = await paymongo.createCheckoutSession({
    lineItems: [{
      amount: req.school.registration_fee,
      currency: 'PHP',
      name: 'Alumni Registration Fee',
      quantity: 1,
    }],
    paymentMethodTypes: ['card', 'gcash', 'paymaya', 'grab_pay'],
    successUrl: `${req.protocol}://${req.headers.host}/register/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${req.protocol}://${req.headers.host}/register`,
    metadata: {
      kind: 'signup',
      school_id: String(req.school.id),
      email,
      password_hash,
      full_name: full_name || '',
      batch_year: batch_year ? String(batch_year) : '',
      contact: contact || '',
      address: address || '',
      member_type: resolvedMemberType,
    },
  });

  res.json({ checkoutUrl: session.checkoutUrl });
}));

router.get('/signup-checkout/:sessionId/status', asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM users WHERE paymongo_checkout_session_id = $1', [req.params.sessionId]);
  if (rows.length === 0) return res.json({ ready: false });

  const user = rows[0];
  delete user.password_hash;
  res.json({ ready: true, token: signToken(user), user });
}));

router.post('/renew-checkout', requireAuth, asyncHandler(async (req, res) => {
  if (!req.school.registration_open) {
    return res.status(400).json({ error: 'Registration is currently closed' });
  }
  if (!req.school.registration_fee || req.school.registration_fee <= 0) {
    return res.status(400).json({ error: 'Registration fee has not been configured yet' });
  }

  const session = await paymongo.createCheckoutSession({
    lineItems: [{
      amount: req.school.registration_fee,
      currency: 'PHP',
      name: 'Alumni Registration Renewal',
      quantity: 1,
    }],
    paymentMethodTypes: ['card', 'gcash', 'paymaya', 'grab_pay'],
    successUrl: `${req.protocol}://${req.headers.host}/dashboard`,
    cancelUrl: `${req.protocol}://${req.headers.host}/dashboard`,
    metadata: {
      kind: 'renewal',
      school_id: String(req.school.id),
      user_id: String(req.user.id),
    },
  });

  res.json({ checkoutUrl: session.checkoutUrl });
}));

module.exports = router;
```

- [ ] **Step 4: Mount the router**

In `alumni-backend/src/server.js`, add after the `schoolRoutes` mount:

```js
const registrationRoutes = require('./routes/registration');
app.use('/api/registration', registrationRoutes);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/registration.test.js --runInBand`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/registration.js alumni-backend/src/server.js alumni-backend/tests/registration.test.js
git commit -m "feat(backend): add signup/renewal PayMongo checkout session routes"
```

---

### Task 5: requireAuth expiry gate

**Files:**
- Modify: `alumni-backend/src/middleware/auth.js`
- Test: `alumni-backend/tests/auth-middleware.test.js` (new — the existing `auth.test.js` covers the `/api/auth/*` routes, this one targets `requireAuth` behavior directly through a protected route)

**Interfaces:**
- Consumes: `user.registration_paid_until`, already selected by `requireAuth`'s existing `SELECT * FROM users WHERE id = $1`.
- Produces: any authenticated request to a non-allowlisted path returns 402 `{ error: 'Registration expired', registrationPaidUntil }` when `user.registration_paid_until < now()`.

- [ ] **Step 1: Write the failing tests**

Create `alumni-backend/tests/auth-middleware.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('a request from a user with an expired registration is blocked with 402', async () => {
  const expiredUser = await insertUser({ registration_paid_until: new Date(Date.now() - 1000).toISOString() });
  const res = await request(app).get('/api/events').set('Authorization', authHeader(expiredUser));
  expect(res.status).toBe(402);
  expect(res.body.error).toBe('Registration expired');
});

test('GET /api/me still works for an expired user (allowlisted)', async () => {
  const expiredUser = await insertUser({ registration_paid_until: new Date(Date.now() - 1000).toISOString() });
  const res = await request(app).get('/api/me').set('Authorization', authHeader(expiredUser));
  expect(res.status).toBe(200);
});

test('POST /api/registration/renew-checkout still works for an expired user (allowlisted)', async () => {
  const expiredUser = await insertUser({ registration_paid_until: new Date(Date.now() - 1000).toISOString() });
  const res = await request(app).post('/api/registration/renew-checkout').set('Authorization', authHeader(expiredUser));
  // Not 402 — it may still fail with 400 (no fee configured) but must not be blocked by the expiry gate.
  expect(res.status).not.toBe(402);
});

test('a request from a user with a future registration_paid_until succeeds normally', async () => {
  const user = await insertUser({ registration_paid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
  const res = await request(app).get('/api/events').set('Authorization', authHeader(user));
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/auth-middleware.test.js --runInBand`
Expected: the first test FAILS (currently returns 200, no gate exists yet). The others should already pass (no regression), but run them together to confirm the baseline.

- [ ] **Step 3: Add the gate to `requireAuth`**

**Important — do not use `req.path` here.** `requireAuth` is invoked from inside many different routers, each mounted at a different `app.use('/api/xxx', ...)` prefix (`/api/registration`, `/api`, `/api/admin`, etc.). Express strips the mount prefix from `req.url`/`req.path` before handing off to a mounted sub-router (confirmed against Express 4's own docs: "When called from a middleware, the mount point is not included in `req.path`"), so inside `requireAuth`, `req.path` for a request to `POST /api/registration/renew-checkout` would actually be `/renew-checkout`, not the full path — a hardcoded full-path allowlist checked against `req.path` would never match, silently blocking the very renew endpoint an expired user needs to unblock themselves (and `/api/me`/`/api/school` too). `req.originalUrl` is the property that always holds the full original path regardless of nesting depth — use that instead (this is exactly why the pre-existing `trialExpired` allowlist in `tenant.js` gets away with using `req.path`: `resolveTenant` runs as top-level `app.use()` middleware, before any prefix-stripping has happened yet — `requireAuth` has no such guarantee since it's invoked from within nested routers).

In `alumni-backend/src/middleware/auth.js`, modify the `requireAuth` function — insert the gate right after `req.user = user;` and before `next();`:

```js
    req.user = user;

    const REGISTRATION_ALLOWLIST = ['/api/me', '/api/school', '/api/registration/renew-checkout'];
    const requestPath = req.originalUrl.split('?')[0];
    if (user.registration_paid_until && new Date(user.registration_paid_until) < new Date() && !REGISTRATION_ALLOWLIST.includes(requestPath)) {
      return res.status(402).json({ error: 'Registration expired', registrationPaidUntil: user.registration_paid_until });
    }

    next();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/auth-middleware.test.js --runInBand`
Expected: all 4 tests PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand`
Expected: all suites pass — this is the riskiest change in the plan (a global gate on `requireAuth`), so confirm nothing else regressed. Every `insertUser()` call across the existing suite gets `registration_paid_until` defaulted by the DB column default... **note:** the schema's `registration_paid_until` has **no default value** (Task 1 only backfills existing rows once; new rows via `insertUser`, which does a raw INSERT with an explicit column list from its `defaults`/`overrides` merge, will leave it NULL unless set). Since the gate's condition starts with `user.registration_paid_until &&`, a NULL value short-circuits to `false` (gate does not block), so existing tests that don't pass `registration_paid_until` keep working unaffected. This is intentional — confirm it holds by checking this full-suite run is green.

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/middleware/auth.js alumni-backend/tests/auth-middleware.test.js
git commit -m "feat(backend): block expired registrations in requireAuth"
```

---

### Task 6: Payments webhook

**Files:**
- Create: `alumni-backend/src/routes/paymentsWebhook.js`
- Modify: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/paymentsWebhook.test.js`

**Interfaces:**
- Consumes: `req.rawBody` (added to `server.js`'s `express.json()` call), `paymongo.verifyWebhookSignature` (Task 2), `query`/`queryForSchool` from `../db`.
- Produces: `POST /api/payments/webhook`, mounted **before** `resolveTenant` in `server.js` (like `/api/platform`).

- [ ] **Step 1: Capture the raw request body in `server.js`**

In `alumni-backend/src/server.js`, change:

```js
app.use(express.json({ limit: '2mb' }));
```

to:

```js
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
```

- [ ] **Step 2: Write the failing tests**

Create `alumni-backend/tests/paymentsWebhook.test.js`:

```js
const crypto = require('crypto');
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query } = require('../src/db');
const { resetDb, getDefaultSchool, insertUser } = require('./helpers');
const { hashPassword } = require('../src/lib/password');

const WEBHOOK_SECRET = 'test-webhook-secret';

beforeAll(() => { process.env.PAYMONGO_WEBHOOK_SECRET = WEBHOOK_SECRET; });
beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

function signedRequest(payload) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  return { rawBody, header: `t=${timestamp},te=${te},li=deadbeef` };
}

function checkoutPaidEvent(eventId, sessionId, metadata) {
  return {
    data: {
      id: eventId,
      attributes: {
        type: 'checkout_session.payment.paid',
        data: {
          id: sessionId,
          attributes: { metadata },
        },
      },
    },
  };
}

test('rejects a request with a missing/invalid signature', async () => {
  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ data: { id: 'evt_bad' } }));
  expect(res.status).toBe(400);
});

test('creates a new user from a signup webhook event', async () => {
  const school = await getDefaultSchool();
  const password_hash = await hashPassword('secret123');
  const payload = checkoutPaidEvent('evt_signup1', 'cs_signup1', {
    kind: 'signup',
    school_id: String(school.id),
    email: 'webhookuser@test.com',
    password_hash,
    full_name: 'Webhook User',
    batch_year: '2020',
    contact: '',
    address: '',
    member_type: 'alumnus',
  });
  const { rawBody, header } = signedRequest(payload);

  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('Paymongo-Signature', header)
    .send(rawBody);

  expect(res.status).toBe(200);

  const rows = await query('SELECT * FROM users WHERE email = $1', ['webhookuser@test.com']);
  expect(rows.length).toBe(1);
  expect(rows[0].paymongo_checkout_session_id).toBe('cs_signup1');
  expect(new Date(rows[0].registration_paid_until) > new Date()).toBe(true);
});

test('extends registration_paid_until from a renewal webhook event', async () => {
  const school = await getDefaultSchool();
  const user = await insertUser({ school_id: school.id, registration_paid_until: new Date(Date.now() + 1000).toISOString() });
  const payload = checkoutPaidEvent('evt_renew1', 'cs_renew1', {
    kind: 'renewal',
    school_id: String(school.id),
    user_id: String(user.id),
  });
  const { rawBody, header } = signedRequest(payload);

  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('Paymongo-Signature', header)
    .send(rawBody);

  expect(res.status).toBe(200);

  const rows = await query('SELECT registration_paid_until FROM users WHERE id = $1', [user.id]);
  const newExpiry = new Date(rows[0].registration_paid_until);
  const almostTwoYearsFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 1.9);
  expect(newExpiry > almostTwoYearsFromNow).toBe(true);
});

test('is idempotent — redelivering the same event does not double-process', async () => {
  const school = await getDefaultSchool();
  const user = await insertUser({ school_id: school.id, registration_paid_until: new Date(Date.now() + 1000).toISOString() });
  const payload = checkoutPaidEvent('evt_dupe1', 'cs_dupe1', {
    kind: 'renewal',
    school_id: String(school.id),
    user_id: String(user.id),
  });
  const { rawBody, header } = signedRequest(payload);

  await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('Paymongo-Signature', header).send(rawBody);
  const rowsAfterFirst = await query('SELECT registration_paid_until FROM users WHERE id = $1', [user.id]);

  await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('Paymongo-Signature', header).send(rawBody);
  const rowsAfterSecond = await query('SELECT registration_paid_until FROM users WHERE id = $1', [user.id]);

  expect(rowsAfterSecond[0].registration_paid_until).toEqual(rowsAfterFirst[0].registration_paid_until);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/paymentsWebhook.test.js --runInBand`
Expected: FAIL — route doesn't exist yet (404s).

- [ ] **Step 4: Create `paymentsWebhook.js`**

Create `alumni-backend/src/routes/paymentsWebhook.js`:

```js
const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { query, queryForSchool } = require('../db');
const paymongo = require('../lib/paymongo');

const router = express.Router();

router.post('/webhook', asyncHandler(async (req, res) => {
  const signatureHeader = req.headers['paymongo-signature'];
  const valid = paymongo.verifyWebhookSignature(req.rawBody, signatureHeader, process.env.PAYMONGO_WEBHOOK_SECRET);
  if (!valid) return res.status(400).json({ error: 'Invalid signature' });

  const event = req.body.data;
  const eventId = event.id;
  const eventType = event.attributes.type;

  const dedup = await query(
    `INSERT INTO processed_webhook_events (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,
    [eventId]
  );
  if (dedup.length === 0) return res.status(200).json({ received: true, duplicate: true });

  if (eventType !== 'checkout_session.payment.paid') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const session = event.attributes.data;
  const metadata = session.attributes.metadata || {};
  const schoolId = Number(metadata.school_id);

  if (metadata.kind === 'signup') {
    await queryForSchool(
      schoolId,
      `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, contact, address, member_type, registration_paid_until, paymongo_checkout_session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() + interval '2 years', $9)`,
      [
        schoolId,
        metadata.email,
        metadata.password_hash,
        metadata.full_name || null,
        metadata.batch_year ? Number(metadata.batch_year) : null,
        metadata.contact || null,
        metadata.address || null,
        metadata.member_type,
        session.id,
      ]
    );
  } else if (metadata.kind === 'renewal') {
    await queryForSchool(
      schoolId,
      `UPDATE users SET registration_paid_until = GREATEST(registration_paid_until, now()) + interval '2 years' WHERE id = $1`,
      [Number(metadata.user_id)]
    );
  }

  res.status(200).json({ received: true });
}));

module.exports = router;
```

- [ ] **Step 5: Mount the router before `resolveTenant`**

In `alumni-backend/src/server.js`, add right after the `platformAdminRoutes` mount and **before** `app.use(resolveTenant);`:

```js
const paymentsWebhookRoutes = require('./routes/paymentsWebhook');
app.use('/api/payments', paymentsWebhookRoutes);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/paymentsWebhook.test.js --runInBand`
Expected: all 4 tests PASS.

- [ ] **Step 7: MANDATORY manual verification against a real PayMongo webhook**

This step is not optional — the signature algorithm in Task 2 is a best-effort implementation, not a confirmed one (see the design spec's risk note).

1. Start the backend locally and expose it with a tunnel (e.g. `ngrok http 4000`, or any equivalent) so PayMongo can reach `POST https://<tunnel-host>/api/payments/webhook`.
2. In the PayMongo Dashboard (test mode) → Developers → Webhooks, register that URL for the `checkout_session.payment.paid` event. Copy the generated webhook signing secret into `alumni-backend/.env` as `PAYMONGO_WEBHOOK_SECRET` and restart the backend.
3. Trigger a real event: either use the dashboard's "send test webhook" feature if available, or create a real checkout session (Task 4's endpoint, or directly via curl against PayMongo's API) with a tiny test amount and complete it using PayMongo's documented test payment credentials for test mode.
4. Watch the backend logs / add a temporary `console.log` at the top of the webhook handler if needed. Confirm the request arrives, `verifyWebhookSignature` returns `true`, and the expected DB write happens.
5. **If verification fails**: log the raw `Paymongo-Signature` header value received and compare it against what Task 2's implementation expects. Adjust `verifyWebhookSignature`'s parsing/algorithm to match what PayMongo actually sends, re-run Task 2's unit tests after fixing them to match the corrected format, and repeat this step until a real webhook verifies successfully.
6. Once confirmed working, remove any temporary debug logging added for this step.

- [ ] **Step 8: Commit**

```bash
git add alumni-backend/src/routes/paymentsWebhook.js alumni-backend/src/server.js alumni-backend/tests/paymentsWebhook.test.js
git commit -m "feat(backend): handle PayMongo checkout_session.payment.paid webhook"
```

---

### Task 7: `Register.jsx` checkout flow and fee display

**Files:**
- Modify: `alumni-frontend/src/pages/Register.jsx`

**Interfaces:**
- Consumes: `api` from `../api` (existing instance); `GET /school` already fetched by `useAuth()`'s `school` value (Task 3 added `registration_open`/`registration_fee` to that response, so no new fetch needed here).

- [ ] **Step 1: Replace the submit handler and add the fee/closed-state UI**

In `alumni-frontend/src/pages/Register.jsx`, replace the top of the file through the end of `onSubmit`. `useNavigate`/`nav` are dropped entirely — nothing in this file uses them once `onSubmit` redirects via `window.location.href` instead of navigating client-side, and there's no other usage of `nav` elsewhere in this file:

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function Register() {
  const { school } = useAuth();
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', batch_year: '', contact: '', address: '', member_type: 'alumnus'
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/registration/signup-checkout', {
        ...form,
        batch_year: form.batch_year ? parseInt(form.batch_year) : null,
      });
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setErr(e.response?.data?.error || 'Register failed');
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Show the fee and a closed-registration message**

Insert right after the `{err && (...)}` block and before `<form onSubmit={onSubmit} ...>`:

```jsx
          {school && !school.registration_open && (
            <div className="bg-white border-2 border-[var(--brand-ink)] text-[var(--brand-ink)] font-semibold p-4 rounded-[var(--radius)] mb-5 text-sm">
              Registration is currently closed. Please check back later.
            </div>
          )}

          {school && school.registration_open && school.registration_fee > 0 && (
            <div className="bg-[var(--brand-surface)] border-2 border-[var(--brand-ink)] p-4 rounded-[var(--radius)] mb-5 text-sm">
              Registration fee: <span className="font-bold">₱{(school.registration_fee / 100).toFixed(2)}</span> — you'll be redirected to complete payment after submitting this form.
            </div>
          )}
```

Wrap the existing `<form onSubmit={onSubmit} ...>...</form>` block in a condition so it only renders when registration is actually open and a fee is configured — change:

```jsx
          <form onSubmit={onSubmit} className="space-y-5">
```

to:

```jsx
          {school && school.registration_open && school.registration_fee > 0 && (
          <form onSubmit={onSubmit} className="space-y-5">
```

and add a matching `)}` right after the form's closing `</form>` tag (before the "Already have an account?" paragraph).

Also update the submit button label to make the payment redirect explicit:

```jsx
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Redirecting to payment...' : <>Continue to Payment <ArrowRight size={18} /></>}
            </Button>
```

- [ ] **Step 3: Lint**

Run: `cd alumni-frontend && npx eslint src/pages/Register.jsx` (PowerShell if Bash's `npx` fails to resolve `node`)
Expected: no new errors beyond the project's pre-existing baseline.

- [ ] **Step 4: Build**

Run: `cd alumni-frontend && npm run build` (PowerShell if Bash fails)
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/src/pages/Register.jsx
git commit -m "feat(frontend): redirect Register.jsx to PayMongo checkout, show fee/closed state"
```

---

### Task 8: `RegisterSuccess.jsx` polling page

**Files:**
- Create: `alumni-frontend/src/pages/RegisterSuccess.jsx`
- Modify: `alumni-frontend/src/auth.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `GET /registration/signup-checkout/:sessionId/status` (Task 4); a new `setSession(token, user)` method added to the auth context.
- Produces: route `/register/success` (matches the `success_url` built in Task 4's `signup-checkout` handler: `.../register/success?session_id={CHECKOUT_SESSION_ID}`).

- [ ] **Step 1: Add `setSession` to `auth.jsx` and reuse it from `login`/`register`**

In `alumni-frontend/src/auth.jsx`, replace the `login` and `register` functions and add `setSession`:

```jsx
  const setSession = (token, user) => {
    localStorage.setItem('token', token);
    connectSocket(token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setSession(data.token, data.user);
    await refresh();
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setSession(data.token, data.user);
    await refresh();
    return data.user;
  };
```

Add `setSession` to the context value:

```jsx
    <AuthCtx.Provider value={{ user, login, register, logout, loading, refresh, school, trialExpired, setSession }}>
```

(`registrationExpired` is added to this provider value in Task 9, not here — adding it now would reference a variable that doesn't exist until Task 9's `useState` is added, breaking this task's own lint/build step.)

- [ ] **Step 2: Create `RegisterSuccess.jsx`**

Create `alumni-frontend/src/pages/RegisterSuccess.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, XCircle } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Wordmark } from '../components/ui';

const MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;

export default function RegisterSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { setSession, refresh } = useAuth();
  const nav = useNavigate();
  const [failed, setFailed] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) { setFailed(true); return; }

    let cancelled = false;

    const poll = async () => {
      attemptsRef.current += 1;
      try {
        const { data } = await api.get(`/registration/signup-checkout/${sessionId}/status`);
        if (cancelled) return;
        if (data.ready) {
          setSession(data.token, data.user);
          await refresh();
          nav('/dashboard');
          return;
        }
      } catch {
        // keep polling — a transient error shouldn't fail the whole flow early
      }
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        if (!cancelled) setFailed(true);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => { cancelled = true; };
  }, [sessionId, setSession, refresh, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-surface)] p-6">
      <Panel className="max-w-md w-full p-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2">
          <Wordmark />
        </div>
        {failed ? (
          <>
            <div className="mx-auto mb-4 w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-danger)] border-2 border-[var(--brand-ink)] flex items-center justify-center">
              <XCircle className="text-white" size={26} />
            </div>
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Still processing</h1>
            <p className="text-slate-600">
              Your payment may still be confirming. If this takes more than a minute, please try logging in — your account may already be ready.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 animate-spin text-[var(--brand-accent)]" size={32} />
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Confirming your payment...</h1>
            <p className="text-slate-600">This usually takes a few seconds.</p>
          </>
        )}
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Register the route**

In `alumni-frontend/src/App.jsx`, add the import near the other page imports:

```jsx
import RegisterSuccess from './pages/RegisterSuccess';
```

Add the route inside `<Routes>`, next to the existing `/register` route:

```jsx
        <Route path="/register/success" element={<RegisterSuccess />} />
```

Also add `/register/success` to the `publicOnlyRoutes` array in `Shell` (so it renders without the authenticated sidebar, same as `/register` itself):

```jsx
  const publicOnlyRoutes = ['/', '/login', '/register', '/register/success', '/signup'];
```

- [ ] **Step 4: Lint and build**

Run: `cd alumni-frontend && npx eslint src/pages/RegisterSuccess.jsx src/auth.jsx src/App.jsx` (PowerShell if needed)
Expected: no new errors.

Run: `cd alumni-frontend && npm run build` (PowerShell if needed)
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/src/pages/RegisterSuccess.jsx alumni-frontend/src/auth.jsx alumni-frontend/src/App.jsx
git commit -m "feat(frontend): add RegisterSuccess polling page and shared setSession helper"
```

---

### Task 9: `RenewRegistration.jsx` and the expiry gate wiring

**Files:**
- Create: `alumni-frontend/src/pages/RenewRegistration.jsx`
- Modify: `alumni-frontend/src/api.js`
- Modify: `alumni-frontend/src/auth.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `POST /registration/renew-checkout` (Task 4); the 402 `{ error: 'Registration expired', registrationPaidUntil }` response shape (Task 5).
- Produces: a full-block screen shown whenever any API call 402s with that specific error, mirroring the existing `TrialExpired` mechanism without breaking it.

- [ ] **Step 1: Add a second 402 handler in `api.js`**

In `alumni-frontend/src/api.js`, replace the `trialExpiredHandler` block and the response interceptor:

```js
let trialExpiredHandler = null;
export function setTrialExpiredHandler(fn) {
  trialExpiredHandler = fn;
}

let registrationExpiredHandler = null;
export function setRegistrationExpiredHandler(fn) {
  registrationExpiredHandler = fn;
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
    if (error.response && error.response.status === 402) {
      if (error.response.data.error === 'Registration expired' && registrationExpiredHandler) {
        registrationExpiredHandler(error.response.data);
      } else if (trialExpiredHandler) {
        trialExpiredHandler(error.response.data);
      }
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 2: Wire the handler and state in `auth.jsx`**

Add a `registrationExpired` state and register its handler, next to the existing `trialExpired` wiring:

```jsx
import { api, setTrialExpiredHandler, setRegistrationExpiredHandler } from './api';
```

```jsx
  const [registrationExpired, setRegistrationExpired] = useState(null);
```

```jsx
  useEffect(() => {
    setTrialExpiredHandler((data) => setTrialExpired(data));
    setRegistrationExpiredHandler((data) => setRegistrationExpired(data));
    api.get('/school').then((r) => setSchool(r.data)).catch(() => {});
  }, []);
```

Update the context value (adding `registrationExpired` to what Task 8 left in place):

```jsx
    <AuthCtx.Provider value={{ user, login, register, logout, loading, refresh, school, trialExpired, registrationExpired, setSession }}>
```

- [ ] **Step 3: Create `RenewRegistration.jsx`**

Create `alumni-frontend/src/pages/RenewRegistration.jsx`:

```jsx
import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Wordmark } from '../components/ui';

export default function RenewRegistration() {
  const { registrationExpired, school, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const renew = async () => {
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/registration/renew-checkout');
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not start payment');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-surface)] p-6">
      <Panel className="max-w-md w-full p-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2">
          <Wordmark />
        </div>
        <div className="mx-auto mb-4 w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-danger)] border-2 border-[var(--brand-ink)] flex items-center justify-center">
          <CreditCard className="text-white" size={26} />
        </div>
        <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Registration expired</h1>
        {registrationExpired?.registrationPaidUntil && (
          <p className="text-xs text-slate-500 mb-4">
            Expired {new Date(registrationExpired.registrationPaidUntil).toLocaleDateString()}
          </p>
        )}
        <p className="text-slate-600 mb-6">Renew your registration to continue using the app.</p>
        {err && <p className="text-[var(--brand-danger)] text-sm mb-4">{err}</p>}
        <Button onClick={renew} disabled={loading} className="mx-auto">
          {loading ? 'Redirecting...' : school?.registration_fee > 0 ? `Pay ₱${(school.registration_fee / 100).toFixed(2)} to Renew` : 'Renew Registration'}
        </Button>
        <button onClick={logout} className="block mx-auto mt-6 text-sm text-slate-400 hover:text-[var(--brand-ink)] underline">
          Log out
        </button>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `App.jsx`'s `Shell`**

In `alumni-frontend/src/App.jsx`, add the import:

```jsx
import RenewRegistration from './pages/RenewRegistration';
```

In `Shell`, add `registrationExpired` to the destructure and check it alongside `trialExpired`:

```jsx
  const { user, trialExpired, registrationExpired } = useAuth();
```

```jsx
  if (user && trialExpired) return <TrialExpired />;
  if (user && registrationExpired) return <RenewRegistration />;
```

- [ ] **Step 5: Lint and build**

Run: `cd alumni-frontend && npx eslint src/pages/RenewRegistration.jsx src/api.js src/auth.jsx src/App.jsx` (PowerShell if needed)
Expected: no new errors.

Run: `cd alumni-frontend && npm run build` (PowerShell if needed)
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/pages/RenewRegistration.jsx alumni-frontend/src/api.js alumni-frontend/src/auth.jsx alumni-frontend/src/App.jsx
git commit -m "feat(frontend): add RenewRegistration full-block screen for expired accounts"
```

---

### Task 10: Admin registration settings panel

**Files:**
- Modify: `alumni-frontend/src/auth.jsx`
- Modify: `alumni-frontend/src/pages/AdminUsers.jsx`

**Interfaces:**
- Consumes: `GET /school` (already fetched via `useAuth()`'s `school`), `PATCH /api/admin/school` (Task 3).
- Produces: a new `refreshSchool` method on the auth context.

- [ ] **Step 1: Add `refreshSchool` to `auth.jsx`**

The existing `refresh()` only re-fetches `/me` — it never touches `school` state, which is set once on mount and otherwise never updated. Without a way to re-fetch it, the admin settings panel (and anywhere else `school` is read) would keep showing stale `registration_open`/`registration_fee` after saving. In `alumni-frontend/src/auth.jsx`, add a sibling function next to `refresh`:

```jsx
  const refreshSchool = () => api.get('/school').then((r) => setSchool(r.data)).catch(() => {});
```

Add it to the context value (alongside the others already there):

```jsx
    <AuthCtx.Provider value={{ user, login, register, logout, loading, refresh, refreshSchool, school, trialExpired, registrationExpired, setSession }}>
```

- [ ] **Step 2: Add the settings panel above the user table**

In `alumni-frontend/src/pages/AdminUsers.jsx`, add imports and local state for the registration settings, and a small panel rendered before the existing `<Panel className="overflow-hidden">` (the user table):

```jsx
import { useEffect, useState } from 'react';
import { Shield, UserX, UserCheck, Trash2, Crown, Star, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Badge, Avatar, Button, Input } from '../components/ui';

export default function AdminUsers() {
  const { user: me, school, refreshSchool } = useAuth();
  const [users, setUsers] = useState([]);
  const [feeInput, setFeeInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const load = () => api.get('/admin/users').then((r) => setUsers(r.data.users));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (school) setFeeInput(school.registration_fee ? (school.registration_fee / 100).toFixed(2) : '');
  }, [school]);

  const toggleRegistrationOpen = async () => {
    setSavingSettings(true);
    await api.patch('/admin/school', { registration_open: !school.registration_open });
    await refreshSchool();
    setSavingSettings(false);
  };

  const saveFee = async () => {
    const pesos = parseFloat(feeInput);
    if (isNaN(pesos) || pesos < 0) return;
    setSavingSettings(true);
    await api.patch('/admin/school', { registration_fee: Math.round(pesos * 100) });
    await refreshSchool();
    setSavingSettings(false);
  };
```

- [ ] **Step 3: Add the panel JSX**

Insert right after the page's header block (`<p className="text-slate-500 mt-1">Manage alumni accounts, roles, and membership status</p></div>`) and before the existing `<Panel className="overflow-hidden">`:

```jsx
      <Panel className="p-6 mb-6">
        <h2 className="font-bold text-[var(--brand-ink)] mb-4">Registration Settings</h2>
        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={toggleRegistrationOpen}
            disabled={savingSettings}
            className="flex items-center gap-2 font-semibold text-sm text-[var(--brand-ink)]"
          >
            {school?.registration_open ? <ToggleRight className="text-[var(--brand-success)]" size={28} /> : <ToggleLeft className="text-slate-400" size={28} />}
            Registration is {school?.registration_open ? 'Open' : 'Closed'}
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-[var(--brand-ink)]">Fee (₱)</label>
            <Input className="w-32" value={feeInput} onChange={(e) => setFeeInput(e.target.value)} placeholder="200.00" />
            <Button type="button" variant="secondary" onClick={saveFee} disabled={savingSettings}>Save</Button>
          </div>
        </div>
      </Panel>
```

- [ ] **Step 4: Lint**

Run: `cd alumni-frontend && npx eslint src/auth.jsx src/pages/AdminUsers.jsx` (PowerShell if needed)
Expected: no new errors. `ToggleLeft`/`ToggleRight` must exist in `lucide-react` — if lint or build reports them missing, verify with `node -e "const i=require('lucide-react'); console.log(!!i.ToggleLeft, !!i.ToggleRight)"` and substitute `Power`/`PowerOff` (already proven to exist in this codebase, used in `PlatformDashboard.jsx`) if they don't.

- [ ] **Step 5: Build**

Run: `cd alumni-frontend && npm run build` (PowerShell if needed)
Expected: build succeeds.

- [ ] **Step 6: Manual verification (full flow, needs the real PayMongo test keys already in `.env`)**

Start both dev servers. As a school admin, open Users, set a registration fee (e.g. ₱1.00 in test mode — PayMongo test mode does not charge real money) and confirm registration is Open. Log out, go to `/register`, fill the form, submit, confirm the browser redirects to a real `checkout.paymongo.com` URL. Complete payment using PayMongo's documented test-mode payment credentials for whichever method you choose. Confirm you land on `/register/success`, it shows the spinner, then redirects to `/dashboard` once the webhook (Task 6, already registered against a tunnel) fires. Confirm the new user appears in the admin's Users list.

- [ ] **Step 7: Commit**

```bash
git add alumni-frontend/src/auth.jsx alumni-frontend/src/pages/AdminUsers.jsx
git commit -m "feat(frontend): add registration open/fee settings panel to AdminUsers"
```
