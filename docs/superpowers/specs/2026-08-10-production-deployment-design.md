# Production Deployment (Vercel + Render + Supabase) Design

## Background

The reported bug — "signup fails when a photo is attached" — does not reproduce against the current codebase (`910c25b`). Direct API testing and a full real-browser walkthrough (fill form, attach a real photo, submit) both completed successfully: the form posts to `/registration/signup-checkout`, the photo (base64) is staged in `pending_signups`, and PayMongo returns a checkout URL.

The actual blocker is that the frontend has been deployed to Vercel, but there is no production database or backend host connected yet — `alumni-backend` and its Postgres database only exist locally. This spec covers wiring up a working production deployment so signup (photo included) works end-to-end on the live URL.

## Goals

- Get the live Vercel-hosted frontend talking to a real backend + database, so signup (with or without a photo) works in production.
- Keep changes minimal and consistent with existing patterns (e.g. `VITE_SOCKET_URL`).
- Do not weaken the existing multi-tenant safety guard for future schools — the fix must be explicitly scoped to one school, not a blanket production fallback.

## Non-goals

- Custom domain / per-school subdomains (deferred — using the free `*.vercel.app` URL for now).
- Switching PayMongo to live keys (stays in test mode for this pass).
- Rebuilding the demo/dev seed data (`db/seed.js`) for production use.

## Architecture

| Layer | Where | Why |
|---|---|---|
| Frontend (`alumni-frontend`) | Vercel, `*.vercel.app` (already deployed) | Static Vite/React build |
| Backend (`alumni-backend`) | Render.com free Web Service | Express + Socket.io needs a long-running process; Vercel serverless functions can't hold a websocket connection open |
| Database | Supabase (Postgres) | Provides a plain Postgres instance to host the app's 3-role RLS setup (`postgres`, `alumni_app`, `alumni_platform`) |
| Payments | PayMongo test keys (unchanged) | Verifies the full flow before switching to live keys |

## Design details

### 1. Frontend ↔ backend wiring

`alumni-frontend/src/socket.js:3` already reads `VITE_SOCKET_URL` (default `http://localhost:4000`) to locate the backend for the realtime chat socket. `alumni-frontend/src/api.js:4-8` hardcodes `baseURL: '/api'`, which only resolves correctly locally because Vite's dev server proxies `/api` to `localhost:4000` (`vite.config.js`). Nothing performs that proxy on Vercel.

Add a matching `VITE_API_BASE_URL` env var to `api.js`, defaulting to `''` (today's relative-path behavior, unchanged for local dev), used as the axios `baseURL` prefix. In Vercel's production env vars, set it to the Render backend's origin (e.g. `https://alumni-backend.onrender.com`). This mirrors the existing `VITE_SOCKET_URL` seam rather than introducing a new mechanism (e.g. a Vercel rewrite proxy).

### 2. Single-tenant resolution in production

`resolveTenant` (`alumni-backend/src/middleware/tenant.js:8-60`) resolves the active school from the first label of the `Host` header, enabling per-school subdomains. Its `DEFAULT_SCHOOL_SLUG` fallback (`tenant.js:36`) is explicitly gated to non-production (`process.env.NODE_ENV !== 'production'`) — a deliberate guard against a request silently resolving to the wrong tenant in a real multi-tenant deployment.

Since only one real school exists today and there's no subdomain to key off of on a bare `*.vercel.app` URL, introduce a new env var, `SINGLE_TENANT_SLUG`, that:
- Is allowed in production (unlike `DEFAULT_SCHOOL_SLUG`).
- Only ever resolves to the one school slug it's set to — never derived from request data — so it cannot be used to cross into another tenant's data even if multiple schools exist in the same database.
- Is checked only as a last resort, after subdomain match and after Bearer-token `school_id` lookup, so the moment a real subdomain is introduced for a second school, subdomain resolution takes over automatically and this var becomes irrelevant for that request path.

This is additive to the existing `DEFAULT_SCHOOL_SLUG` (which stays as the dev/test convenience it already is) — not a replacement.

### 3. Supabase database setup

Run `alumni-backend/db/schema.sql` (via `npm run migrate` pointed at the Supabase connection string) against a fresh Supabase project. It's idempotent (`CREATE TABLE IF NOT EXISTS`, role creation guarded by `IF NOT EXISTS`), and creates the `alumni_app` / `alumni_platform` roles plus RLS policies matching local dev.

After migrating, insert one real row into `schools` (slug matching `SINGLE_TENANT_SLUG`, real name, `registration_open = true`, real `registration_fee`) — a one-off SQL statement, not `db/seed.js` (which seeds unrelated demo/fixture schools and fake alumni for local development).

### 4. Render + PayMongo wiring

- Render Web Service: build command `npm install`, start command `node src/server.js`, health check path `/api/health`.
- Env vars on Render: `DATABASE_URL` / `APP_DATABASE_URL` / `PLATFORM_DATABASE_URL` (Supabase connection strings, using the Supabase-issued `alumni_app`/`alumni_platform` role passwords, not the local dev ones), `JWT_SECRET` (a new production secret — not `dev-secret-not-for-production`), `SINGLE_TENANT_SLUG`, `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` (test keys, unchanged), `PAYMONGO_WEBHOOK_SECRET` (new — see below), `PORT`.
- Register a new webhook endpoint in the PayMongo dashboard pointing at `https://<render-app>.onrender.com/api/payments/webhook`. PayMongo issues a distinct signing secret per registered endpoint, so the existing `PAYMONGO_WEBHOOK_SECRET` (scoped to whatever local/ngrok endpoint it was created for) won't validate signatures for the new Render URL — it must be replaced with the new one.

## Verification

Repeat the same repro used to rule out a code bug, against the live Vercel URL instead of localhost: fill out the signup form, attach a real photo, submit, confirm redirect to PayMongo checkout, complete a test payment, and confirm the webhook creates the `users` row with `profile_pic` populated (mirrors `paymentsWebhook.js:31-57`).

## Open questions for later (not blocking this pass)

- Custom domain + per-school subdomains, once a second school is added.
- Switching to live PayMongo keys.
- Render free-tier cold starts (~50s) could cause a PayMongo webhook call to time out if the service has spun down from inactivity — acceptable for now, worth revisiting if it causes missed registrations.
