# Platform (Master) Admin — Design

**Date:** 2026-08-08
**Scope:** `alumni-backend` (new `platform_admins` table, a dedicated `alumni_platform` Postgres role with `BYPASSRLS`, bootstrap-only signup, login, and school-management endpoints) and `alumni-frontend` (a new, completely separate `/platform/*` section — signup, login, dashboard — that bypasses the normal school-tenant app shell).

## Problem

There is currently no way to see or manage schools across the whole platform without connecting to Postgres directly. Every "control" action today (marking a school `active`, extending a trial, deactivating or removing a school) is a manual `psql` command. This was explicitly deferred in both the original multi-tenant SaaS design doc and the school-signup-with-trial design doc as a "platform-operator cross-school dashboard," and it's now needed: a single master admin account that can see every school and take action on it, separate from any individual school's own admin.

## Goals

- A single master admin account (or a handful, but bootstrapped once) can log in at `/platform/login` and see every school on the platform — name, slug, plan/trial status, active flag, alumni count, event count.
- From that dashboard, the master admin can: activate/deactivate a school, mark a school's plan `active` (skip/end its trial), extend a school's trial by 30 days, or delete a school entirely (with its data cascading away).
- The account that can do all this is created once via a bootstrap-only signup (`/platform/signup`) that permanently refuses further signups the instant one platform admin exists — no standing public endpoint that mints cross-school-visibility accounts.
- Cross-school data access is confined to one auditable code path: a dedicated Postgres role (`alumni_platform`, `BYPASSRLS`) used *exclusively* by platform-admin routes, never by any school-scoped request handling.
- Platform admin identity is structurally distinct from a school user's — a separate `platform_admins` table and a JWT carrying `type: 'platform_admin'`, so a school-admin token can never be mistaken for a platform-admin token or vice versa.

## Non-goals

- Real billing/payment integration — "mark plan active" and "extend trial" are the same manual-override actions you'd otherwise run by hand in `psql`, just as dashboard buttons. No Stripe, no invoicing.
- Editing a school's own data (alumni records, events, etc.) from the platform dashboard — view (aggregate counts only) and the four control actions above, nothing else. Per the school-signup-trial design's decomposition, a full per-school drill-down/directory view is explicitly out of scope for this pass.
- Multiple platform-admin roles/permission levels — every platform admin can do everything described here; there's no "read-only platform viewer" tier.
- Inviting additional platform admins after the bootstrap signup closes — if you need a second one later, that's a manual DB insert (same category of manual step as everything else here), not a feature to build now.
- A dedicated `admin.yourapp.com` subdomain — `/platform/*` lives on the base domain, alongside the school-signup page.

## Architecture

### Schema

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

`platform_admins` has no `school_id` and no RLS policy — it isn't tenant data, it's platform-operator data, structurally outside the tenant system entirely (matching the original multi-tenant design doc's framing).

`alumni_platform` gets `UPDATE`/`DELETE` on `schools` (needed for activate/deactivate/plan changes/deletion) but only `SELECT` on every tenant-scoped table (needed for the alumni/event *counts*, nothing more — the role can never write a school's own data). `BYPASSRLS` is what lets a single query aggregate counts across every school at once; without it, RLS's fail-closed default (no `app.school_id` session var set) would return zero rows for everything.

### Connection pool

`alumni-backend/src/db.js` gets one more pool, alongside the existing `pool` (superuser, migrations/seeding) and `appPool` (used via `queryForSchool` for tenant-scoped requests):

```js
const platformPool = new Pool({ connectionString: resolveConnectionString('PLATFORM_DATABASE_URL') });

async function platformQuery(text, params) {
  const result = await platformPool.query(text, params);
  return result.rows;
}

module.exports = { pool, appPool, platformPool, query, queryForSchool, platformQuery };
```

`PLATFORM_DATABASE_URL`/`TEST_PLATFORM_DATABASE_URL` (`postgres://alumni_platform:alumni_platform_dev@localhost:8000/alumni[_test]`) join `APP_DATABASE_URL`/`TEST_APP_DATABASE_URL` in `.env.example`. Every platform-admin route uses `platformQuery(...)` — never `query()` or `req.db(...)` — so "which code can see across schools" stays a one-role, one-pool, grep-able property.

### Auth

- JWT payload for a platform admin: `{ type: 'platform_admin', id }` — no `school_id`, no `role`. Structurally can't pass the existing `requireAuth`'s `payload.school_id !== req.school.id` check (there's no `school_id` to match), and a school-user JWT structurally can't pass the new `requirePlatformAdmin` check either (no `type` claim).
- New middleware `alumni-backend/src/middleware/platformAuth.js`:

```js
const { verifyToken } = require('../lib/token');
const { platformQuery } = require('../db');

async function requirePlatformAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (payload.type !== 'platform_admin') return res.status(401).json({ error: 'Invalid or expired token' });

  const rows = await platformQuery('SELECT id, email FROM platform_admins WHERE id = $1', [payload.id]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid or expired token' });

  req.platformAdmin = rows[0];
  next();
}

module.exports = { requirePlatformAdmin };
```

### Routes

New `alumni-backend/src/routes/platformAdmin.js`, registered in `server.js` *before* `resolveTenant` (same placement as the existing public school-signup route — platform routes never resolve a tenant):

- `POST /api/platform/admin/signup` — public, but bootstrap-gated: `SELECT COUNT(*) FROM platform_admins`; if `> 0`, `403 { error: 'Platform admin already set up' }`. Otherwise creates the row (hashed password) and returns a token, same shape as the existing school-signup response.
- `POST /api/platform/admin/login` — public. Email/password against `platform_admins`, returns `{ token }` on success.
- `GET /api/platform/admin/schools` — `requirePlatformAdmin`. One query:

```sql
SELECT s.id, s.slug, s.name, s.active, s.plan, s.trial_ends_at, s.created_at,
  (SELECT COUNT(*)::int FROM users u WHERE u.school_id = s.id AND u.is_bot = false) AS alumni_count,
  (SELECT COUNT(*)::int FROM events e WHERE e.school_id = s.id) AS event_count
FROM schools s ORDER BY s.created_at DESC;
```

- `PATCH /api/platform/admin/schools/:id` — `requirePlatformAdmin`. Body is one of `{ active: boolean }`, `{ plan: 'active' }`, or `{ extendTrialDays: number }` (always `30` from the UI, but the field stays generic). Whichever key is present drives one `UPDATE schools SET ... WHERE id = $1`.
- `DELETE /api/platform/admin/schools/:id` — `requirePlatformAdmin`. Body must include `{ confirmSlug }`; the handler first looks up the school, compares `confirmSlug` against its actual `slug`, and only proceeds with the `DELETE FROM schools WHERE id = $1` (which cascades to every `school_id`-referencing table via the existing `ON DELETE CASCADE` foreign keys) if they match — otherwise `400 { error: 'Slug confirmation does not match' }`.

### Frontend

- **`src/pages/PlatformSignup.jsx`** — email/password form only (no school fields). On a `403` from the backend, shows "Platform admin is already set up" instead of the form, rather than a raw error.
- **`src/pages/PlatformLogin.jsx`** — email/password, posts to `/platform/admin/login`, stores the token under a *different* localStorage key (`platform_token`) than the regular school-session `token`, so a browser can hold a school-admin session and a platform-admin session at the same time without clobbering each other.
- **`src/pages/PlatformDashboard.jsx`** — a table of every school (name, slug, status badge combining `active`/`plan`/`trial_ends_at` into one readable state, alumni count, event count) with row actions: Activate/Deactivate toggle, "Mark Active" button (only shown when `plan === 'trial'`), "Extend Trial 30 Days" button, and Delete (opens a small modal requiring the admin to type the school's slug before the button enables).
- **Routing in `App.jsx`:** `Shell` currently branches on `user`/`trialExpired`/`publicOnlyRoutes`, all of which are school-tenant concepts. Any path starting with `/platform` skips `Shell`'s logic entirely (rendered directly, no sidebar, no trial check) — added as an early check in `Shell` alongside the existing `publicOnlyRoutes` branch, since this section never touches `useAuth()`'s school-scoped session at all.

## Data flow

1. You visit `https://yourapp.com/platform/signup` once, create the master account. Every signup attempt after that gets 403.
2. You log in at `/platform/login`, land on `/platform/dashboard`, see every school with live counts.
3. Activate/deactivate, mark-active, extend-trial actions each `PATCH` and refetch the list. Delete requires typing the slug, then `DELETE`s and refetches.
4. None of this touches `req.db`/`queryForSchool`/the `appPool` — every platform-admin query goes through `platformQuery` on the dedicated `alumni_platform` role, independent of and invisible to normal school request handling.

## Error handling

- Bootstrap signup after one exists: `403`, frontend shows a static "already set up" message, not a form-validation-style error.
- Wrong email/password at `/platform/login`: `401`, same generic "Invalid email or password" pattern as the existing school login (doesn't reveal which field was wrong).
- Delete with a mismatched `confirmSlug`: `400`, inline error in the modal, delete button stays disabled until it matches.
- A platform-admin token used against a normal school-scoped route, or a school-user token used against a `/platform/admin/*` route: both `401`, indistinguishable from an expired/invalid token — no information leak about which kind of token was rejected.

## Testing

- Bootstrap gating: first signup succeeds and creates exactly one row; a second signup attempt (with the first still present) returns `403`; after manually deleting the row (simulating a fresh install), signup succeeds again.
- `requirePlatformAdmin` rejects a missing token, an invalid token, a well-formed school-user token (no `type` claim), and a platform-admin token whose `id` no longer exists in `platform_admins` (deleted account).
- `GET /schools` returns correct alumni/event counts against a fixture with multiple schools and mixed data, and that the `alumni_platform` role's `BYPASSRLS` grant is actually required (a control test using the regular `appPool`/`query()` path would return incomplete/zero results for the same cross-school query).
- `PATCH` for each of the three body shapes (`active`, `plan`, `extendTrialDays`) updates exactly the targeted school and no others.
- `DELETE` with a correct `confirmSlug` removes the school and (via a follow-up query) confirms its `users`/`events`/etc. rows are gone too (cascade); a mismatched `confirmSlug` leaves everything untouched and returns `400`.

## Open items for later (explicitly out of scope now)

- Real billing/payment processing behind "mark plan active."
- Per-school drill-down/directory view beyond aggregate counts.
- Multiple platform-admin permission tiers.
- Inviting additional platform admins after bootstrap (manual DB step for now).
- A dedicated `admin.yourapp.com` subdomain.
