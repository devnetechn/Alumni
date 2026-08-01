# Alumni Backend Design

Date: 2026-08-01

## Context

`alumni-frontend` is a working Vite + React + Tailwind app with a full set of pages
(Dashboard, Directory, Events, Jobs, Announcements, Messages, Groups, Notifications,
Profile, AlumniId, AdminUsers, AdminPostings, EventCheckin, EventRegistrations,
ScanRedirect, PublicHome, Login, Register) that all call a REST API under `/api`.
`alumni-backend` is currently an empty directory — nothing has been built yet.

Vite's dev proxy (`alumni-frontend/vite.config.js`) forwards `/api` to
`http://localhost:4000`, and `src/api.js` sends `Authorization: Bearer <token>` from
`localStorage`. This design builds the Node/Express backend that serves that contract.

All required endpoints were derived by grepping every `api.get/post/put/patch/delete`
call across `alumni-frontend/src` (pages, `auth.jsx`, `api.js`) — see "API Surface"
below for the full, verified list.

## Decisions (confirmed with user)

- Database: **PostgreSQL** (already installed and running locally as Windows service
  `postgresql-x64-17` — confirmed via `Get-Service`).
- DB access: **raw SQL** via the `pg` driver — no ORM.
- Real-time: **Socket.io** for messages and notifications (not polling).
- Seed data: **yes** — include a seed script with a default admin account and sample
  alumni/events/jobs so the app is testable immediately after setup.

## Architecture

Resource-based route modules instead of classic MVC (routes/controllers/models):
since there's no ORM abstracting the database, colocating each resource's Express
routes with its SQL queries in one file keeps things readable top-to-bottom. A
separate model layer would add indirection with no payoff here.

```
alumni-backend/
  src/
    server.js            — Express app + HTTP server + Socket.io bootstrap
    db.js                — pg Pool, reads DATABASE_URL
    middleware/
      auth.js             — requireAuth, requireAdmin, requireOfficer (admin OR is_batch_leader)
    lib/
      socket.js            — io instance + emitToUser(userId, event, payload) helper
    routes/
      auth.js               — /auth/login, /auth/register
      me.js                 — /me (GET, PUT)
      alumni.js             — /alumni
      events.js             — /events/* (list, create, delete, rsvp, registrations, checkin, export)
      jobs.js               — /jobs/*
      announcements.js      — /announcements/*
      messages.js           — /messages/*
      groups.js             — /groups/*
      notifications.js      — /notifications
      admin.js              — /admin/users/*
      stats.js              — /stats
  db/
    schema.sql            — full CREATE TABLE statements
    seed.js               — inserts default admin + sample data
  scripts/
    migrate.js             — applies schema.sql to DATABASE_URL
  .env.example
  package.json
```

Single Node process serves both HTTP (Express) and WebSocket (Socket.io) traffic on
`PORT=4000`, matching the Vite proxy target exactly — no reverse proxy or second port
needed in dev.

## Data Model (PostgreSQL)

Auth and profile fields are merged into a single `users` table since the relationship
is always 1:1 (no case in the frontend ever treats them separately).

```sql
users (
  id, email UNIQUE, password_hash,
  role TEXT CHECK (role IN ('admin','alumni')) DEFAULT 'alumni',
  active BOOLEAN DEFAULT true,
  is_batch_leader BOOLEAN DEFAULT false,
  full_name, batch_year INT, course, contact, address, company, position,
  industry, bio, profile_pic TEXT, mentor_available BOOLEAN DEFAULT false,
  nfc_uid, created_at
)

events (
  id, title, description, location, event_date TIMESTAMPTZ,
  created_by -> users.id, created_at
)

event_rsvps (
  id, event_id -> events.id, user_id -> users.id,
  status TEXT CHECK (status IN ('going','maybe','not_going')),
  paid BOOLEAN DEFAULT false, created_at,
  UNIQUE(event_id, user_id)
)

event_checkins (
  id, event_id -> events.id, user_id -> users.id, checked_in_by -> users.id,
  checked_in_at, UNIQUE(event_id, user_id)
)

jobs (
  id, title, company, location, description,
  job_type TEXT CHECK (job_type IN ('job','internship')),
  is_referral BOOLEAN DEFAULT false, posted_by -> users.id, created_at
)

announcements (
  id, title, body, posted_by -> users.id, created_at
)

messages (
  id, sender_id -> users.id, receiver_id -> users.id, body,
  read_at TIMESTAMPTZ NULL, created_at
)

groups (
  id, name, description,
  kind TEXT CHECK (kind IN ('interest','batch','course','mentorship')),
  created_by -> users.id, created_at
)

group_members (
  group_id -> groups.id, user_id -> users.id, joined_at,
  PRIMARY KEY(group_id, user_id)
)

group_posts (
  id, group_id -> groups.id, author_id -> users.id, body, created_at
)

notifications (
  id, user_id -> users.id, type, title, body, link,
  read_at TIMESTAMPTZ NULL, created_at
)
```

**Assumption:** Directory's `location` filter (`Directory.jsx`) maps to the `address`
column — there is no separate "location" field anywhere in `Profile.jsx` or
`Register.jsx`, so reusing `address` avoids adding an unused column.

## API Surface

Base path `/api`. Auth via `Authorization: Bearer <jwt>`, verified by `requireAuth`.

### Auth (`auth.js`, `me.js`) — public except `/me`
- `POST /auth/register` — always creates role `alumni`; returns `{token, user}`
- `POST /auth/login` — returns `{token, user}`
- `GET /me` — auth required
- `PUT /me` — auth required, updates own profile fields

### Alumni Directory (`alumni.js`)
- `GET /alumni?search=&batch=&course=&industry=&company=&location=&mentor=` — auth required

### Events (`events.js`)
- `GET /events` — auth required
- `GET /events/:id` — auth required
- `POST /events` — admin only
- `DELETE /events/:id` — admin only
- `GET /events/:id/rsvp` — auth required — `{counts, myStatus}`
- `POST /events/:id/rsvp` — auth required — upsert own RSVP
- `GET /events/:id/registrations` — admin only
- `PATCH /events/:id/registrations/:alumniId` — admin only — toggles `paid`
- `GET /events/:id/checkin` — auth required — attendance list
- `POST /events/:id/checkin` — admin or `is_batch_leader` only — body `{code}`
  (QR payload `ALUMNI:<id>` or raw `nfc_uid`); rejects unless the alumni has RSVP'd
  `going` and is marked `paid` (gate described in `EventRegistrations.jsx`)
- `GET /events/:id/export` — admin or `is_batch_leader` — CSV of attendance

### Jobs (`jobs.js`)
- `GET /jobs?type=` — public
- `POST /jobs` — auth required (any alumni)
- `DELETE /jobs/:id` — admin or original poster (`poster_email` match)

### Announcements (`announcements.js`)
- `GET /announcements` — public
- `POST /announcements` — admin only
- `DELETE /announcements/:id` — admin only

### Messages (`messages.js`)
- `GET /messages` — auth required — conversation list with `last_body`, `unread_count`
- `GET /messages/:userId` — auth required — thread; marks messages from that user read
- `POST /messages` — auth required — `{receiver_id, body}`; emits `message:new` via
  Socket.io to `user:<receiver_id>`

### Groups (`groups.js`)
- `GET /groups` — auth required — includes `member_count`, `is_member`
- `GET /groups/:id` — auth required — detail + members + `isMember`
- `GET /groups/:id/posts` — auth required
- `POST /groups` — auth required
- `POST /groups/:id/join` / `DELETE /groups/:id/join` — auth required
- `POST /groups/:id/posts` — auth required, must be a member

### Notifications (`notifications.js`)
- `GET /notifications` — auth required
- `PATCH /notifications` — auth required — marks all read

### Admin (`admin.js`)
- `GET /admin/users` — admin only
- `PUT /admin/users/:id` — admin only — `{role?, active?, is_batch_leader?}`
- `DELETE /admin/users/:id` — admin only — server must reject deleting `req.user.id`

### Stats (`stats.js`)
- `GET /stats` — public — `{totalAlumni, totalEvents, totalCheckins, totalMessages,
  registrationsTrend[12mo], checkinsTrend[12mo], byBatch[], byIndustry[],
  eventsByMonth[], topCompanies[], byCourse[]}`, all via `GROUP BY`/`date_trunc`
  aggregate queries.

The generic delete used by `AdminPostings.jsx` (`DELETE /${type}/${id}` where type is
`announcements|events|jobs`) needs no special route — it resolves to the existing
per-resource DELETE routes above since axios's baseURL is already `/api`.

**Poster fields:** `announcements`, `jobs`, and `group_posts` list/detail responses
must JOIN `users` on the posting user and include `poster_name`, `poster_email`,
`poster_pic`, `poster_role`, `poster_position` (group posts use `author_name` /
`author_email` instead, per `Groups.jsx`) — these feed `PosterBadge.jsx` directly.

## Auth Mechanism

- `bcrypt` for password hashing.
- `jsonwebtoken`, signed with `JWT_SECRET` env var, 7-day expiry.
- `middleware/auth.js`: `requireAuth` (verifies JWT, loads `req.user`), `requireAdmin`,
  `requireOfficer` (admin OR `is_batch_leader`).

## Real-time (Socket.io)

- Socket.io attaches to the same HTTP server as Express, same port (4000).
- Client sends its JWT on connect; server verifies and joins the socket to room
  `user:<id>`.
- Events: `message:new` (on successful `POST /messages`, to the receiver's room) and
  `notification:new` (whenever a notification row is inserted).
- **Frontend touch required:** `alumni-frontend/package.json` has no `socket.io-client`
  dependency yet. This design includes adding it, connecting once in `auth.jsx` after
  login (disconnecting on logout), and having `Messages.jsx` / `Notifications.jsx`
  listen for these events to refetch instead of polling. This is intentionally kept
  minimal — no redesign of those pages' UI or state management.

## Env / Scripts

- `.env`: `DATABASE_URL=postgres://postgres:<password>@localhost:5432/alumni`,
  `JWT_SECRET=...`, `PORT=4000`
- `npm run migrate` — applies `db/schema.sql` to `DATABASE_URL`
- `npm run seed` — inserts default admin (`admin@alumni.local` / `admin123`, printed to
  console) plus sample alumni/events/jobs
- `npm run dev` — `node --watch src/server.js`
- No changes needed to `alumni-frontend/vite.config.js` — its proxy already targets
  `http://localhost:4000`.

## Known Gap (explicitly out of scope for this backend-setup task)

`EventCheckin.jsx` currently renders a QR code and an attendance list but never calls
a check-in POST — there is no camera-scanning UI wired up despite `html5-qrcode` being
a frontend dependency. This design builds `POST /events/:id/checkin` so the feature is
backend-complete, but wiring an actual scanner component into `ScanRedirect.jsx` /
`EventCheckin.jsx` is separate frontend work, not part of this task.

## Testing

Each route module gets integration tests (supertest against a test Postgres database)
covering: happy path, auth rejection (401), and role rejection (403) for admin/officer
gated routes. The check-in gate (RSVP going + paid) gets explicit test coverage since
it's the one nontrivial business rule.
