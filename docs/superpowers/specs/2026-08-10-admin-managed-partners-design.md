# Admin-Managed Partners Design

## Background

The homepage's Partnerships section (removed during today's premium-homepage rebuild, folded into "Give Back") is coming back — but this time backed by real data an admin can manage, not static placeholder content, per explicit request.

## Goals

- A `partners` table admins can add to and delete from.
- A public homepage section showing real partner data instead of placeholder cards.
- Follow the codebase's existing conventions closely: `announcements` for the simple admin-CRUD shape (create/delete, no edit), `event_photos`/`profile_pic` for base64-in-Postgres image storage (no disk/S3 anywhere in this app).

## Non-goals

- No edit/update capability — matches the `announcements` pattern (delete and re-add instead of editing in place).
- No partner detail page or click-through — logo, name, and an optional outbound website link is the full scope.

## Design

### Backend

**Schema** (append to `alumni-backend/db/schema.sql`, same shape as `event_photos`/`pending_signups`):

```sql
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON partners;
CREATE POLICY tenant_isolation ON partners
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

GRANT ALL ON partners, partners_id_seq TO alumni_app;
```

`logo` is nullable base64 (same convention as `profile_pic`, `event_photos.media`) — a partner can be added with just a name if no logo is available yet.

**Routes** (`alumni-backend/src/routes/partners.js`, mounted at `/api/partners`, same shape as `announcements.js`):

- `GET /` — public (no auth), returns all partners for the resolved school. Used by the homepage.
- `POST /` — `requireAuth` + `requireAdmin`. Body: `{ name, logo, website_url }`, `name` required, `logo`/`website_url` optional.
- `DELETE /:id` — `requireAuth` + `requireAdmin`.

`tests/helpers.js`'s `resetDb()` TRUNCATE list must include `partners`.

### Frontend

**Admin page** (`alumni-frontend/src/pages/AdminPartnerships.jsx`, route `/admin/partnerships`, nav entry after "Highlights") — a simpler version of `EventPhotosManager`'s upload widget (no per-event selection step, just a flat add-form + list):
- Form: name (text input, required), website URL (text input, optional), logo (file upload using the existing `validateFile`/`resizeImage` helpers from `lib/media.js`, same as `Register.jsx`'s profile photo).
- List: existing partners as cards (logo or fallback icon, name, website link if present, delete button).

**Homepage section** (`alumni-frontend/src/components/home/Partnerships.jsx`) — visually the same treatment as today's earlier (now-deleted) placeholder `Partnership.jsx`, but takes a `partners` prop (real data fetched in `PublicHome.jsx` via a new `api.get('/partners')` call, same pattern as `announcements`/`events`/`highlights`) instead of a hardcoded list. Renders each partner's logo (or a `Building2` icon fallback if no logo), name, and links out to `website_url` if present. Positioned between `AlumniImpact` and `GiveBack`.

## Verification

- Backend: `GET /api/partners` is public; `POST`/`DELETE` require admin (403 for non-admin, matching `announcements.test.js`'s exact assertions); admin can create and delete a partner end-to-end.
- Frontend: admin can add a partner (with and without a logo) from `/admin/partnerships` and see it appear immediately; deleting removes it. The homepage section reflects real data — renders nothing extra when there are zero partners (matches the empty-state-safe pattern already used by `PhotoMosaic`/`SchoolMemories`).
