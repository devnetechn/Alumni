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
