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

## AI support bot

The Messages page includes a reserved "IHES Assistant" bot account (seeded by
`npm run seed`, email `bot@ihes.local`). To have it generate real answers, set
`OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4o-mini`) in
`.env`. Without a key, the bot still replies to every message, just with a
fixed "isn't configured yet" message instead of an AI-generated one — the
rest of the app is unaffected either way.

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

## Frontend

`alumni-frontend`'s Vite dev server proxies `/api` to `http://localhost:4000` — no
extra configuration needed there. Socket.io connects directly to
`http://localhost:4000` (see `alumni-frontend/src/socket.js`).
