# Self-Serve School Signup with Trial — Design

**Date:** 2026-08-08
**Scope:** `alumni-backend` (re-establish the tenant-isolation foundation from the stale `worktree-multi-tenant-core-isolation` branch on top of current `main`, add a `schools.logo`/`trial_ends_at` schema change, a public signup endpoint, and trial-expiry enforcement in the tenant middleware) and `alumni-frontend` (a new signup page and a trial-expired page). No real payment processing — trial-expiry *mechanics* only.

## Problem

The app currently serves one school (IHES) with no way for another school to start using it. A prior branch (`worktree-multi-tenant-core-isolation`) already built the hard part — per-school data isolation via Postgres RLS, tenant-resolution middleware, and school-scoped queries across every route — but it predates the current `main` (which has since gotten a full brutalist frontend redesign) and it stops short of the actual self-serve signup flow: today a school can only be added by manually inserting a row into the `schools` table. There's also no trial/billing concept wired up yet — `schools.plan` exists as a placeholder column but nothing reads or enforces it.

## Goals

- A prospective school can sign itself up (name, subdomain slug, optional logo, first admin's credentials) without anyone manually touching the database.
- Whoever fills out the signup form becomes that school's first admin.
- A school can optionally upload a logo and set its display name at signup time — it replaces the generic icon badge everywhere that badge currently renders (sidebar, mobile header, login panel, landing page header).
- Every new school gets a 30-day trial. After it expires without the school being manually marked `active`, every user at that school is locked out of the app (login still works, but the rest of the API returns 402 and the frontend shows a "trial expired" page) until someone (you, for now) upgrades them.
- Re-establish the tenant-isolation backend work (schools table, RLS, `resolveTenant` middleware, per-route scoping) on top of current `main`, since `main` doesn't have it yet — only the stale branch does.

## Non-goals

- Real payment processing (Stripe or otherwise). The "trial expired" screen's call-to-action is a plain contact link, not a checkout flow. Moving a school from `trial` to `active` is a manual DB update for now.
- Editing the school's logo/name after signup — that's a small separate follow-up (a settings page for school admins).
- Per-school color/theme customization beyond the logo — the platform's brutalist visual system (from the `2026-08-08-frontend-brutalist-redesign-design.md` spec) stays uniform across all schools; only the logo and school name vary per tenant.
- A platform-operator cross-school admin dashboard — still deferred, as in the original multi-tenant SaaS design doc.
- Reconciling the stale branch's frontend changes — this work re-derives the needed *backend* pieces (schema, middleware, route scoping) fresh against current `main` rather than merging that branch's frontend.

## Architecture

### Re-establishing the tenant-isolation foundation on `main`

Current `main` has none of the multi-tenant backend work — it only has the brutalist frontend redesign. Before signup/trial can be built, the following pieces from `worktree-multi-tenant-core-isolation` need to exist on the new branch, ported forward (not merged wholesale, since that branch's frontend is stale):

- `schools` table, `school_id` columns + RLS policies on every tenant-scoped table (`alumni-backend/db/schema.sql`).
- `alumni_app` restricted Postgres role + dual connection pools (`alumni-backend/src/db.js`).
- `resolveTenant` middleware (`alumni-backend/src/middleware/tenant.js`) — subdomain-first, JWT `school_id` fallback for local dev — wired into the request pipeline ahead of every route.
- `school_id` embedded in the JWT payload; `requireAuth` rejects on `payload.school_id !== req.school.id`.
- Every route file's queries converted from the shared pool to `req.db(...)` (announcements, events, groups, jobs, admin, messages, stats, me, alumni, notifications).
- Test fixtures made school-aware; the cross-tenant leak test suite.

This is mechanical porting of already-designed, already-tested code onto a newer base — not a redesign. The implementation plan will treat it as its own early set of tasks before the new signup/trial work.

### Schema additions

```sql
ALTER TABLE schools ADD COLUMN logo TEXT;  -- base64 data URL, same as users.profile_pic
ALTER TABLE schools ADD COLUMN trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days');
```

`schools.plan` (already `TEXT NOT NULL DEFAULT 'trial'` from the ported schema) takes on real meaning now: `'trial'` or `'active'`. There is no self-serve path from `'trial'` to `'active'` in this pass — it's a manual `UPDATE schools SET plan = 'active' WHERE id = $1`, the same kind of manual step already used to seed schools today. This keeps the door open for a real billing integration later without needing another migration.

### Self-serve signup endpoint

`POST /api/platform/schools` — public, reachable on the base domain (no subdomain resolved yet, so this route is registered *outside* the `resolveTenant` middleware chain, same as the design doc's original plan):

- Input: `name`, `slug`, `logo` (optional, base64 data URL, validated as an image and size-capped the same way `profile_pic` is), admin's `full_name`, `email`, `password`.
- Validates `slug` format (`^[a-z0-9-]+$`, matching the existing DB check constraint) and uniqueness against existing `schools` rows and a reserved-word blocklist (`www`, `api`, `admin`, `app`, `platform`, `signup`, `static`, `mail`).
- In one transaction: inserts the `schools` row (`plan = 'trial'`, `trial_ends_at` defaults to `now() + 30 days`, `logo` if provided) and the first `users` row scoped to it with `role = 'admin'`.
- Returns `{ url: 'https://<slug>.yourapp.com' }` for the client to redirect to (in local dev, `<slug>.localhost:5173`, consistent with the subdomain-resolution approach already designed).

### Trial enforcement

In `resolveTenant`, after `req.school` is resolved (and only for the subdomain-resolved path — the JWT-`school_id`-fallback path used by already-authenticated requests hits the same check):

```js
if (req.school.plan === 'trial' && new Date() > new Date(req.school.trial_ends_at)) {
  const allowlist = ['/api/auth/login', '/api/me'];
  if (!allowlist.includes(req.path)) {
    return res.status(402).json({ error: 'Trial expired', trialEndsAt: req.school.trial_ends_at });
  }
}
```

`/api/auth/login` stays reachable so a school isn't confusingly told "invalid credentials" when the real problem is an expired trial — they can still log in and immediately see why they're locked out. `/api/me` stays reachable so the frontend can identify *who* is locked out (to tailor the message: admin vs. regular alumni) without needing a separate unauthenticated "check school status" endpoint.

### Frontend

- **`src/pages/Signup.jsx`** (new): school name, slug (with a live "yourschool.yourapp.com" preview), logo upload reusing `Profile.jsx`'s existing resize-to-400px-then-base64-encode pattern, and the first admin's name/email/password. On success, redirects (full page navigation, since it's a subdomain change) to the returned URL.
- **`src/pages/TrialExpired.jsx`** (new): full-screen replacement for the app shell, shown when any API call returns 402. Message varies slightly by role (`me.role === 'admin'` sees "Your school's trial has ended — contact us to continue" with a `mailto:` link; non-admin alumni see "This school's trial has ended — an admin needs to renew access").
- **`src/api.js`**: an axios response interceptor catches `402` responses and sets a small shared flag (e.g. a module-level `let trialExpired = false` plus a subscriber callback, or lifted into `auth.jsx`'s context) that `App.jsx`'s `Shell` checks to render `TrialExpired` instead of the normal routed page — the same conditional-shell mechanism already used for the public-vs-authenticated layout split.
- **`GET /api/school`** (new, public, no auth required): returns `{ name, logo }` for whichever school `resolveTenant` resolved from the subdomain. Needed because the logo has to render on logged-out surfaces (`PublicHome.jsx`, `Login.jsx`) as well as logged-in ones, and those logged-out pages have no session to pull school data from otherwise.
- **Logo swap-point:** everywhere the generic `GraduationCap` icon badge currently renders as a fallback (`App.jsx` Sidebar/MobileHeader, `PublicHome.jsx` header, `Login.jsx` left panel), it fetches `GET /api/school` once and renders `<img src={school.logo}>` instead when `logo` is present — same conditional pattern `PublicHome.jsx` already uses for its `logo` swap-point constant, just driven by real per-school data now instead of a hardcoded `null`.

## Data flow

1. Prospective school visits the base domain, fills out `Signup.jsx`, `POST /api/platform/schools` creates the `schools` row (trial, 30 days) and first admin `users` row.
2. Redirected to `https://<slug>.yourapp.com/login`, logs in — `resolveTenant` resolves the school by subdomain, trial hasn't expired, everything works normally.
3. Every subsequent request scopes correctly through `req.db(...)` exactly as designed in the original multi-tenant spec.
4. 30 days later, if `plan` is still `'trial'`: any request past `/auth/login`/`/me` gets 402; the frontend renders `TrialExpired` instead of the app.
5. You manually flip `plan` to `'active'` for that school in the database; their next request succeeds normally again — no code path change needed, since enforcement only checks `plan === 'trial'`.

## Error handling

- Duplicate/reserved slug at signup: 409 with a specific message, surfaced inline on the signup form (same pattern as existing `err` state in `Login.jsx`/`Register.jsx`).
- Unknown/inactive subdomain: unchanged from the original design — 404 from `resolveTenant`.
- 402 from an expired trial is handled globally (interceptor), not per-page — no individual page needs new error-handling code for this case.
- A school manually marked `active` before its trial would have expired anyway: enforcement condition (`plan === 'trial' && expired`) simply never triggers — no special-casing needed.

## Testing

- Signup endpoint tests: slug validation (format, reserved words, uniqueness), successful signup creates exactly one `schools` row (with correct `trial_ends_at`) and one admin `users` row scoped to it, logo is stored and retrievable.
- Trial enforcement tests: a request from a school past `trial_ends_at` gets 402 on a normal route but 200 on `/auth/login` and `/me`; a request from a school with `plan = 'active'` succeeds regardless of `trial_ends_at`; a request from a school still within its trial window succeeds.
- Re-run the existing cross-tenant leak test suite (ported from the stale branch) against the new base to confirm isolation still holds after re-basing onto current `main`.
- Frontend: manual verification that `TrialExpired` renders on a 402 and shows the admin vs. non-admin message correctly; that the logo swap-point renders correctly with and without a logo set.

## Open items for later (explicitly out of scope now)

- Real payment processing (Stripe Checkout/subscriptions) to move a school from `trial` to `active` without a manual DB update.
- Editing school logo/name after signup (settings page).
- Per-school color/theme customization beyond the logo.
- Platform-operator cross-school dashboard.
