# Multi-Tenant SaaS Conversion — Design

**Date:** 2026-08-08
**Scope:** `alumni-backend` (new `schools` table, `school_id` on every existing table, tenant-resolution middleware, Row-Level Security, a new platform-admin route group, a new public signup endpoint) and `alumni-frontend` (a new signup page; existing pages are otherwise unaffected). No billing, no branding/theming, no custom domains — those are separate follow-up sub-projects.

## Problem

The app currently serves exactly one school (IHES) against one shared, unscoped database — every table and every query assumes there's only ever one tenant. To turn this into a SaaS product that multiple schools can subscribe to independently, each school's alumni, events, jobs, messages, and everything else must be fully isolated from every other school's, with self-serve signup so new schools can start using the product without manual provisioning.

## Goals

- Any number of schools can use the product concurrently, each with its own alumni, admins, events, jobs, groups, messages, and announcements, completely invisible to every other school.
- New schools can sign themselves up (name + desired subdomain + first admin account) without the platform operator manually provisioning anything.
- Each school is reachable at its own subdomain (e.g. `ihes.yourapp.com`, `ust.yourapp.com`), which doubles as the tenant identifier for every request.
- The platform operator gets a separate, dedicated view across all schools (name, slug, active/subscription status, alumni counts) for billing and support purposes — without that visibility ever being reachable from the same code path or database role used to serve a school's own users.
- Isolation is enforced at the database level (Postgres Row-Level Security), not only in application code, so a missed `WHERE school_id = ...` in a route handler cannot leak another school's data.

## Non-goals

- Billing/subscriptions (Stripe integration, plan enforcement, trial expiry) — `schools.plan` is stored as a placeholder column but nothing reads or enforces it yet.
- Per-school branding/theming (custom logos, colors) beyond storing the school's display name.
- Custom domains — schools get a subdomain of the platform's domain, not their own domain.
- Tenant offboarding tooling (data export, account deletion flows).
- Rate-limiting/abuse prevention on the public signup endpoint. This is a real gap before a public launch but is out of scope for this design.

## Architecture

### Data model

A new table, `schools`, is the tenant registry:

```sql
CREATE TABLE schools (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  plan TEXT NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`slug` is the subdomain (e.g. `ihes`) — lowercase alphanumeric and hyphens only, checked against a reserved-word blocklist (`www`, `api`, `admin`, `app`, `platform`, `signup`, `static`, `mail`, and similar) at creation time.

Every existing table — `users`, `events`, `event_rsvps`, `event_checkins`, `jobs`, `announcements`, `messages`, `groups`, `group_members`, `group_posts`, `notifications` — gets a `school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE` column. This is added directly to every table, including join/child tables that could technically inherit tenancy through a parent (e.g. `event_rsvps` through `events`), so that each table's isolation rule is self-contained (see Row-Level Security below) rather than requiring a join to determine which tenant a row belongs to.

`users.email` changes from globally unique (`UNIQUE`) to unique per school (`UNIQUE(school_id, email)`) — the same email address can belong to different alumni at different schools.

### Row-Level Security

Every tenant-scoped table gets an RLS policy of the form:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table>
  USING (school_id = current_setting('app.school_id', true)::int);
```

The session variable `app.school_id` is set once per request (see Tenant resolution below) and scopes every query that connection runs for the lifetime of that request's transaction. If the variable is unset, the policy's cast fails closed — no rows are returned — so the default behavior on any code path that forgets to set it is "see nothing," never "see everything."

### Platform-admin access (cross-tenant)

The platform operator's dashboard needs to see across all schools (for billing/support), which RLS is explicitly designed to prevent for normal request handling. This is resolved with a second, dedicated Postgres role — e.g. `alumni_platform_ro` — granted `BYPASSRLS`, used *exclusively* by the platform-admin route group's database connection. Regular per-school request handling never uses this role. This makes "which code can ever see cross-tenant data" an auditable, database-level property (a distinct connection string/role to grep for) rather than something that depends on every route handler getting its `WHERE` clauses right.

Platform admins are their own concept, not a `users.role = 'admin'` scoped to some school — a `platform_admins` table (`id, email, password_hash, created_at`) with its own login endpoint and its own JWT (carrying a `type: 'platform_admin'` claim so it's structurally distinct from a per-school user token) sits outside the tenant system entirely.

### Tenant resolution middleware

For every request other than platform-admin routes and the public signup endpoint:

1. Parse the subdomain from the `Host` header (e.g. `ihes.yourapp.com` → `ihes`).
2. Look up the `schools` row by slug. If missing or `active = false`, respond 404.
3. Attach `req.school = { id, slug, name }`.
4. Check out a dedicated client from the connection pool for this request (rather than using the shared pool-wide `query()` helper), run `BEGIN; SET LOCAL app.school_id = <id>;` on it, and expose the rest of the request's queries through a `req.db(...)` function bound to that same client/transaction. Commit and release the client when the response finishes; roll back and release on error.

Every route handler's existing `const { query } = require('../db'); query(...)` calls are replaced with `req.db(...)`. This is the largest mechanical part of the implementation — it touches all 11 existing route files — but each individual change is the same shape everywhere.

In local development, `*.localhost` subdomains (e.g. `ihes.localhost:5173`) resolve to `127.0.0.1` in every modern browser with no `/etc/hosts` changes, so local dev exercises the exact same subdomain-routing path as production.

### Auth changes

- `POST /api/auth/login` looks up the user scoped to `req.school.id` (`WHERE school_id = $1 AND email = $2`), not just by email.
- The JWT issued on login carries a `school_id` claim alongside the user id.
- `requireAuth` middleware, after verifying the token's signature, additionally checks `payload.school_id === req.school.id` and rejects (401) on mismatch — this stops a token minted on one school's subdomain from ever being accepted on another's, independent of and prior to RLS.
- `POST /api/auth/register` inserts the new user scoped to `req.school.id`.

### Self-serve signup

A new public endpoint, `POST /api/platform/schools`, reachable on the base domain (no subdomain resolved, since the school doesn't exist yet):

- Input: school name, desired slug, first admin's name/email/password.
- Validates slug format and uniqueness against the reserved-word blocklist and existing `schools` rows.
- In one transaction: inserts the `schools` row and the first user (`role = 'admin'`) scoped to it.
- Returns the new subdomain URL (e.g. `https://ihes.yourapp.com`) for the client to redirect to.

### Frontend impact

A new signup page (served at the base domain) is the only new frontend surface. Every existing page (`Dashboard.jsx`, `Directory.jsx`, `Messages.jsx`, `Events.jsx`, etc.) needs no changes — they already call `/api/...` relative to whatever origin they're loaded from, so once the browser is on a school's subdomain, every request is automatically scoped correctly by the backend's tenant resolution. `Login.jsx`'s current hardcoded demo-credential hint becomes misleading in a multi-school world and should be removed as part of this work, though redesigning the login page itself is not otherwise in scope.

## Data flow

1. A prospective school visits the base domain, fills out the signup form, and `POST /api/platform/schools` creates their `schools` row and first admin user.
2. They're redirected to `https://<slug>.yourapp.com`, where `Login.jsx` (unchanged) logs them in against a tenant-resolved backend.
3. Every subsequent request from their browser carries the subdomain in its `Host` header; the tenant-resolution middleware turns that into `req.school` and a `req.db(...)` bound to that school's RLS session variable for the duration of the request.
4. The platform operator separately logs into a platform-admin-only surface (base domain or a dedicated `admin.yourapp.com`) using `platform_admins` credentials, whose routes exclusively use the `BYPASSRLS` database role to see across all schools.

## Error handling

- Unknown or inactive subdomain: 404 from the tenant-resolution middleware; the frontend shows a "this school isn't set up" page rather than a raw error.
- A JWT whose `school_id` doesn't match the resolved subdomain: 401, identical to an invalid/expired token from the caller's perspective.
- An application bug that queries without going through `req.db` (e.g. an accidental direct `query()` import): RLS's fail-closed default means it returns zero rows rather than another school's data — a correctness bug that surfaces as "nothing shows up," not a data leak. This is exactly why the cross-tenant tests below exist: a test suite that only checks "school A sees its own data" cannot detect this class of bug.

## Testing

- A new cross-tenant leak test suite is the highest-priority addition: seed two schools (A and B) with their own data, authenticate as a school-A user, and assert that requests attempting to reach school-B rows (including by guessing a valid id from school B) return 404/empty — never school B's actual data.
- Every existing test file's shared fixtures (`insertUser()`, `resetDb()` in `tests/helpers.js`) need to be updated to create/select a school context first, since every row in every table now requires a `school_id`. This is a rewrite of existing test scaffolding, not just additive new tests.
- Signup endpoint tests: slug validation (format, reserved words, uniqueness), and that a successful signup creates exactly one `schools` row and one admin user scoped to it.
- Platform-admin route tests confirm the `BYPASSRLS` role path returns data across schools, and that regular per-school auth tokens are rejected by platform-admin routes (and vice versa — a platform-admin token rejected by per-school routes).

## Open items for later (explicitly out of scope now)

- Billing/subscription enforcement against `schools.plan`.
- Per-school branding/theming.
- Custom domains per school.
- Tenant offboarding/data export tooling.
- Rate-limiting and abuse prevention on `POST /api/platform/schools` before any public launch.
