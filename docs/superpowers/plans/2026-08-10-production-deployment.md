# Production Deployment (Vercel + Render + Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the live Vercel-hosted alumni-frontend talking to a real backend (Render) and database (Supabase), so signup — including photo upload — works end to end in production.

**Architecture:** Frontend on Vercel (static build), backend on Render (long-running Express + Socket.io process), database on Supabase (Postgres). Frontend locates the backend via a new `VITE_API_BASE_URL` env var (mirroring the existing `VITE_SOCKET_URL` pattern). Backend resolves the single production school via a new `SINGLE_TENANT_SLUG` env var, additive to the existing dev-only `DEFAULT_SCHOOL_SLUG`.

**Tech Stack:** Express, PostgreSQL (`pg`), React + Vite, axios, Jest + Supertest (backend tests).

## Global Constraints

- PayMongo stays in test-mode keys for this pass — no live keys.
- No custom domain — deploy to the free `*.vercel.app` URL.
- `SINGLE_TENANT_SLUG` must only ever resolve to one hardcoded school slug from an env var, never from request data, and must be checked after subdomain and Bearer-token resolution (see `docs/superpowers/specs/2026-08-10-production-deployment-design.md`).
- Do not modify or remove the existing `DEFAULT_SCHOOL_SLUG` dev fallback behavior.

---

### Task 1: Backend — add `SINGLE_TENANT_SLUG` production fallback

**Files:**
- Modify: `alumni-backend/src/middleware/tenant.js:36-41`
- Modify: `alumni-backend/.env.example`
- Test: `alumni-backend/tests/tenant.test.js`

**Interfaces:**
- Consumes: `process.env.SINGLE_TENANT_SLUG` (new env var, read at request time, same as existing `DEFAULT_SCHOOL_SLUG`).
- Produces: nothing new consumed by other tasks — this is a leaf change to `resolveTenant`.

- [ ] **Step 1: Write the failing tests**

Add to `alumni-backend/tests/tenant.test.js` (after the existing `falls back to the JWT school_id...` test):

```js
test('falls back to SINGLE_TENANT_SLUG even in production when Host and token do not resolve', async () => {
  const school = await makeSchool('single-tenant-test');
  const app = buildApp();
  const originalEnv = process.env.NODE_ENV;
  const originalSlug = process.env.SINGLE_TENANT_SLUG;
  process.env.NODE_ENV = 'production';
  process.env.SINGLE_TENANT_SLUG = 'single-tenant-test';
  try {
    const res = await request(app).get('/whoami').set('Host', 'unrecognized.example.com');
    expect(res.status).toBe(200);
    expect(res.body.schoolId).toBe(school.id);
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.SINGLE_TENANT_SLUG = originalSlug;
  }
});

test('SINGLE_TENANT_SLUG does not override a resolved subdomain match', async () => {
  const hostSchool = await makeSchool('host-match-test');
  await makeSchool('single-tenant-other');
  const app = buildApp();
  const originalSlug = process.env.SINGLE_TENANT_SLUG;
  process.env.SINGLE_TENANT_SLUG = 'single-tenant-other';
  try {
    const res = await request(app).get('/whoami').set('Host', 'host-match-test.example.com');
    expect(res.status).toBe(200);
    expect(res.body.schoolId).toBe(hostSchool.id);
  } finally {
    process.env.SINGLE_TENANT_SLUG = originalSlug;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd alumni-backend && npx cross-env NODE_ENV=test npx jest tests/tenant.test.js -v`
Expected: the two new tests FAIL (404 instead of 200), existing tests still PASS.

- [ ] **Step 3: Implement `SINGLE_TENANT_SLUG` fallback**

In `alumni-backend/src/middleware/tenant.js`, after the existing `DEFAULT_SCHOOL_SLUG` block (currently lines 36-41) and before the `if (!school) { return res.status(404)... }` check, add:

```js
    if (!school && process.env.SINGLE_TENANT_SLUG) {
      const singleTenant = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active, registration_open, registration_fee FROM schools WHERE slug = $1', [process.env.SINGLE_TENANT_SLUG]);
      if (singleTenant.length > 0 && singleTenant[0].active) {
        school = singleTenant[0];
      }
    }
```

Unlike `DEFAULT_SCHOOL_SLUG`, this has no `NODE_ENV !== 'production'` guard — it's meant for production single-tenant deployments and is safe because it always resolves to the one slug fixed in the env var, never to request-supplied data.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd alumni-backend && npx cross-env NODE_ENV=test npx jest tests/tenant.test.js -v`
Expected: all tests PASS.

- [ ] **Step 5: Document the new env var**

In `alumni-backend/.env.example`, add after the `DEFAULT_SCHOOL_SLUG=` line:

```
# Production single-tenant fallback: which school to serve when a request's
# Host header has no recognizable subdomain (e.g. a bare Vercel URL with no
# custom domain). Unlike DEFAULT_SCHOOL_SLUG, this is allowed in production —
# it always resolves to exactly this one school, never from request data, so
# it's safe as long as you only have one school on this deployment. Drop it
# once you add per-school subdomains for a second school.
SINGLE_TENANT_SLUG=
```

- [ ] **Step 6: Commit**

```bash
cd alumni-backend
git add src/middleware/tenant.js .env.example tests/tenant.test.js
git commit -m "feat(backend): add SINGLE_TENANT_SLUG production tenant fallback"
```

---

### Task 2: Frontend — add `VITE_API_BASE_URL` for the REST client

**Files:**
- Modify: `alumni-frontend/src/api.js:1-8`
- Create: `alumni-frontend/.env.example`

**Interfaces:**
- Consumes: `import.meta.env.VITE_API_BASE_URL` (new env var).
- Produces: `api.defaults.baseURL` used by every `api.*` call in the frontend — no other task depends on this beyond Task 6 (Vercel env var) supplying the value.

- [ ] **Step 1: Update `api.js` to read the env var**

In `alumni-frontend/src/api.js`, replace:

```js
// Same-origin: /api proxied to backend by Vite in dev, and by reverse proxy in prod.
export const API_BASE = '';

export const api = axios.create({
  baseURL: '/api',
});
```

with:

```js
// In local dev, Vite proxies /api to the backend (see vite.config.js) so this
// stays relative. In production, VITE_API_BASE_URL points at the deployed
// backend origin (e.g. https://alumni-backend.onrender.com) — same pattern
// as VITE_SOCKET_URL in socket.js.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
});
```

- [ ] **Step 2: Verify locally**

Run: `cd alumni-frontend && npm run dev`, open the app, confirm signup/login still work (no `VITE_API_BASE_URL` set locally, so `API_BASE` is `''` and behavior is unchanged from before this task).

- [ ] **Step 3: Create `.env.example` documenting both frontend env vars**

Create `alumni-frontend/.env.example`:

```
# Backend origin for REST calls. Leave unset for local dev (Vite proxies
# /api to localhost:4000 — see vite.config.js). In production, set to the
# deployed backend's origin, e.g. https://alumni-backend.onrender.com
VITE_API_BASE_URL=

# Backend origin for the realtime chat socket. Leave unset for local dev
# (defaults to http://localhost:4000). In production, same value as
# VITE_API_BASE_URL above.
VITE_SOCKET_URL=
```

- [ ] **Step 4: Commit**

```bash
cd alumni-frontend
git add src/api.js .env.example
git commit -m "feat(frontend): add VITE_API_BASE_URL for the deployed backend origin"
```

---

### Task 3: Create the Supabase project and run the migration

No code changes — this is you acting on the Supabase dashboard, with exact commands to run locally against it.

- [ ] **Step 1: Create the Supabase project**

Go to https://supabase.com, sign in/sign up, click "New project". Pick any name (e.g. `alumni-production`), a strong database password (save it — this becomes part of your `DATABASE_URL`), and the region closest to your users.

- [ ] **Step 2: Get the connection string**

In the Supabase dashboard: Project Settings → Database → Connection string → URI. Copy it — it looks like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```
This is your admin/superuser connection — it becomes `DATABASE_URL`.

- [ ] **Step 3: Run the schema migration against Supabase**

From `alumni-backend`, temporarily point `DATABASE_URL` at the Supabase connection string and run the existing migration script:

```bash
cd alumni-backend
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres" npm run migrate
```

Expected output: `Migration complete.` This creates all tables, the `alumni_app` and `alumni_platform` roles (with the dev passwords `alumni_app_dev` / `alumni_platform_dev` baked into `db/schema.sql:4` and `db/schema.sql:253` — see Step 4 to change them), and RLS policies.

- [ ] **Step 4: Set stronger passwords for the app roles**

The dev passwords in `schema.sql` are fine for local Postgres but shouldn't carry over to production. Connect with `psql` (or the Supabase SQL editor) using the `DATABASE_URL` from Step 2 and run:

```sql
ALTER ROLE alumni_app WITH PASSWORD 'REPLACE_WITH_A_GENERATED_SECRET';
ALTER ROLE alumni_platform WITH PASSWORD 'REPLACE_WITH_A_DIFFERENT_GENERATED_SECRET';
```

Generate two random secrets (e.g. `openssl rand -base64 24` twice) and keep them — they go into `APP_DATABASE_URL` and `PLATFORM_DATABASE_URL` in Task 5.

- [ ] **Step 5: Insert your real school row**

Still via `psql`/SQL editor on the Supabase connection, insert your actual school (this is the row `SINGLE_TENANT_SLUG` from Task 1 will point at) — replace the slug/name/fee with your real values:

```sql
INSERT INTO schools (slug, name, active, plan, registration_open, registration_fee)
VALUES ('isidro-hulom', 'Isidro Hulom Elementary School Alumni Association', true, 'paid', true, 10000);
```

(`registration_fee` is in centavos — `10000` = ₱100.00, matching what's already configured for this school locally.)

---

### Task 4: Deploy the backend to Render

- [ ] **Step 1: Create the Render Web Service**

Go to https://render.com, sign in/sign up, "New +" → "Web Service". Connect the GitHub repo, set:
- Root directory: `alumni-backend`
- Build command: `npm install`
- Start command: `node src/server.js`
- Health check path: `/api/health`
- Plan: Free

- [ ] **Step 2: Set environment variables on Render**

In the Render service's "Environment" tab, add:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
APP_DATABASE_URL=postgresql://alumni_app:[SECRET-FROM-TASK-3-STEP-4]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
PLATFORM_DATABASE_URL=postgresql://alumni_platform:[OTHER-SECRET-FROM-TASK-3-STEP-4]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
JWT_SECRET=[a newly generated secret, e.g. `openssl rand -base64 32` — NOT dev-secret-not-for-production]
SINGLE_TENANT_SLUG=isidro-hulom
PAYMONGO_SECRET_KEY=[your existing sk_test_... key]
PAYMONGO_PUBLIC_KEY=[your existing pk_test_... key]
PAYMONGO_WEBHOOK_SECRET=[placeholder for now — updated in Task 5]
PORT=4000
```

- [ ] **Step 3: Deploy and verify health**

Trigger the deploy (Render does this automatically on env var save / push). Once live, visit `https://<your-render-app>.onrender.com/api/health` and confirm it returns `{"ok":true}`.

---

### Task 5: Register the PayMongo webhook for the Render URL

- [ ] **Step 1: Register the webhook**

In the PayMongo dashboard (test mode) → Developers → Webhooks → "Add endpoint". URL: `https://<your-render-app>.onrender.com/api/payments/webhook`. Events: `checkout_session.payment.paid` (matches what `alumni-backend/src/routes/paymentsWebhook.js:23` checks for).

- [ ] **Step 2: Copy the new signing secret into Render**

PayMongo shows a signing secret for this specific endpoint (starts `whsk_...`). Update `PAYMONGO_WEBHOOK_SECRET` in the Render environment variables (Task 4 Step 2) with this value and redeploy.

---

### Task 6: Point Vercel at the Render backend

- [ ] **Step 1: Set Vercel environment variables**

In the Vercel project's Settings → Environment Variables, add for the Production environment:

```
VITE_API_BASE_URL=https://<your-render-app>.onrender.com
VITE_SOCKET_URL=https://<your-render-app>.onrender.com
```

- [ ] **Step 2: Redeploy the frontend**

Trigger a redeploy (Vercel → Deployments → redeploy latest, or push a commit) so the build picks up the new env vars — Vite inlines `import.meta.env.VITE_*` at build time, so a running deployment won't pick these up without a rebuild.

---

### Task 7: End-to-end verification on the live URL

- [ ] **Step 1: Repeat the signup + photo repro against production**

Visit your live Vercel URL `/register`. Fill out the form, attach a real photo, submit. Expected: redirect to a PayMongo checkout page (mirrors the local repro already confirmed in this session).

- [ ] **Step 2: Complete a test payment**

Use PayMongo's test card numbers (from their docs) to complete the checkout.

- [ ] **Step 3: Confirm the account was created with the photo**

Log in with the new account on the live site and confirm the profile photo appears (this exercises `paymentsWebhook.js:31-57` copying `profile_pic` from `pending_signups` into `users` against the real Supabase database).

- [ ] **Step 4: Check Render logs if anything fails**

Render's Logs tab shows backend `console.error` output (`server.js:73-76` logs all unhandled errors) — check there first if the webhook doesn't fire or the checkout call fails.
