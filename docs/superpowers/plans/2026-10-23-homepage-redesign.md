# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage below the hero into admin-managed sections (Overview, Announcements, last-event recap + per-batch gallery, Projects, Faces Behind the Success, Sponsorship, Partnership), every card linking to its own page.

**Architecture:** New tenant-scoped tables and Express routes (public GET, admin-only writes), new React admin pages and public detail pages following existing patterns, then `PublicHome.jsx` is recomposed from small section components in `components/home/`.

**Tech Stack:** Express + pg + Jest/supertest (backend); React + Vite + Tailwind + react-router + lucide-react (frontend).

**Spec:** `docs/superpowers/specs/2026-10-23-homepage-redesign-design.md`

## Global Constraints

- **Do not run `git commit`/`git push`.** The user commits when they say so. No task has a commit step.
- Backend writes use `requireAuth, requireAdmin`; public GETs have no auth. Use `req.db(sql, params)` and `asyncHandler`.
- Every new table: `school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE`, `ENABLE ROW LEVEL SECURITY`, `tenant_isolation` policy, `GRANT ALL ON <table>, <table>_id_seq TO alumni_app` (copy the `partners` block in `alumni-backend/db/schema.sql`).
- Images are stored as data-URL TEXT, resized client-side with `resizeImage`/`validateFile` from `src/lib/media.js`.
- Add each new table to the `TRUNCATE` list in `alumni-backend/tests/helpers.js`.
- Styling: existing CSS vars (`--navy`, `--gold`, `--paper-2`), `serif`, `Section`/`Empty` from `components/PageHeader`, lucide icons.
- Homepage section order: Hero, Overview, Announcements, Recap + Gallery, Projects, Faces Behind the Success, Sponsorship, Partnership, then the existing final "Join" CTA band.
- Backend tests: `cd alumni-backend && npm run migrate:test && npm test -- <file>`. Frontend check: `cd alumni-frontend && npm run lint && npm run build`.

## Review Focus

- Unknown/non-numeric `:id` on any new detail route returns 404, not 500.
- A section with no data renders nothing (or a tidy empty state) on the homepage, never fake content.
- Batch-scoped (private) events never appear in the homepage recap; only `batch_id IS NULL` events.
- Sponsor inquiry with missing name/email, or invalid email, returns 400; no admin auth needed to submit, but listing needs admin.
- Agenda items that are malformed (not an array, missing `activity`) are rejected with 400.

---

### Task 1: Schema for new tables and columns

**Files:**
- Modify: `alumni-backend/db/schema.sql` (append)
- Modify: `alumni-backend/tests/helpers.js` (TRUNCATE list)
- Test: `alumni-backend/tests/schema.test.js` (extend, following its existing style)

**Interfaces:**
- Produces tables: `batch_gallery(id, school_id, batch_id → batches ON DELETE CASCADE, media TEXT NOT NULL, caption TEXT, created_at)`, `projects(id, school_id, title NOT NULL, summary, description, image, batch_id nullable → batches ON DELETE SET NULL, lead_name, featured BOOLEAN DEFAULT false, created_at)`, `alumni_stories(id, school_id, name NOT NULL, batch_label, role_title, photo, quote, story, featured BOOLEAN DEFAULT true, created_at)`, `sponsor_inquiries(id, school_id, name NOT NULL, email NOT NULL, organization, message, created_at)`.
- Produces columns: `schools.overview_title TEXT`, `schools.overview_body TEXT`, `schools.overview_image TEXT`; `announcements.agenda JSONB NOT NULL DEFAULT '[]'`.
- Note: `batch_gallery` references `batches`, which is created in `migrations_premium.sql`, so put the `batch_gallery` and `projects` tables in `migrations_premium.sql`; the rest in `schema.sql`. `migrate.js` runs schema first, premium second.

- [ ] **Step 1: Write the failing test** in `schema.test.js`: `test('homepage tables and columns exist')` querying `information_schema.columns` and asserting each table above exists and that `schools` has `overview_body` and `announcements` has `agenda`.
- [ ] **Step 2: Run** `npm run migrate:test && npm test -- schema` → FAIL (tables missing).
- [ ] **Step 3: Add the DDL** (use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) plus RLS/GRANT per Global Constraints; update the TRUNCATE list in `helpers.js`.
- [ ] **Step 4: Run** `npm run migrate:test && npm test -- schema` → PASS.

### Task 2: Overview (schools) API + admin page

**Files:**
- Modify: `alumni-backend/src/routes/school.js` (`publicSchool`, `EDITABLE`)
- Test: `alumni-backend/tests/school.test.js`
- Create: `alumni-frontend/src/pages/AdminOverview.jsx`
- Modify: `alumni-frontend/src/App.jsx` (route `/admin/overview`, nav item)

**Interfaces:**
- Consumes: Task 1 columns.
- Produces: `GET /api/school` now returns `overview_title`, `overview_body`, `overview_image`; `PATCH /api/school` accepts them (admin only). Frontend reads them from `useAuth().school`.

- [ ] **Step 1: Write failing tests** in `school.test.js`: admin PATCH `{overview_title:'Reconnecting', overview_body:'Proof of life'}` returns 200 and a following `GET /api/school` (with `Host: hostFor(school)`) returns both; alumni PATCH returns 403.
- [ ] **Step 2: Run** `npm test -- school` → FAIL.
- [ ] **Step 3: Add the three fields** to `publicSchool` and `EDITABLE`. Note `PATCH` coerces values with `String(...).trim() || null`, which is fine for the data-URL image.
- [ ] **Step 4: Run** `npm test -- school` → PASS.
- [ ] **Step 5: Build `AdminOverview`** modeled on `AdminPartnerships.jsx`: title input, body textarea, image upload (resize `maxDim: 1200`), save via `api.patch('/school', {...})`. Check `auth.jsx` exposes a way to refresh `school` after saving; if not, reload the page data locally.
- [ ] **Step 6: Verify** `npm run lint && npm run build` in `alumni-frontend` passes.

### Task 3: Announcements with agenda and public detail page

**Files:**
- Modify: `alumni-backend/src/routes/announcements.js`
- Test: `alumni-backend/tests/announcements.test.js`
- Create: `alumni-frontend/src/pages/AnnouncementDetail.jsx`
- Modify: `alumni-frontend/src/pages/Announcements.jsx` (agenda editor in the admin form, link cards to detail)
- Modify: `alumni-frontend/src/App.jsx` (public route `/announcements/:id`)

**Interfaces:**
- Produces: agenda item shape `{ time: string, activity: string }`; `POST /api/announcements` accepts optional `agenda: Item[]`; `GET /api/announcements/:id` → `{ announcement }` (public, with `poster_name`), 404 if not found or id non-numeric.
- The notification link for new announcements changes to `/announcements/${announcement.id}`.

- [ ] **Step 1: Write failing tests**: POST with `agenda:[{time:'9:00 AM',activity:'Registration'}]` returns `announcement.agenda` equal to it; POST with `agenda:'x'` or an item missing `activity` returns 400; `GET /api/announcements/:id` public returns 200; `GET /api/announcements/abc` and `/9999` return 404.
- [ ] **Step 2: Run** `npm test -- announcements` → FAIL.
- [ ] **Step 3: Implement** a `validateAgenda(agenda): Item[] | null` helper in the route file (null means invalid; undefined input means `[]`), store with `JSON.stringify`, add the `GET /:id` handler (reject `!/^\d+$/` ids with 404), update the notification link.
- [ ] **Step 4: Run** `npm test -- announcements` → PASS.
- [ ] **Step 5: Build `AnnouncementDetail`** (title, date, body, agenda as a timeline list) and add the agenda editor (add/remove rows of time + activity) to the existing admin form in `Announcements.jsx`; make each list card a `Link` to `/announcements/:id`.
- [ ] **Step 6: Verify** frontend lint + build pass.

### Task 4: Event recap and per-batch gallery

**Files:**
- Modify: `alumni-backend/src/routes/eventPhotos.js` (add `GET /recap`, placed before any `/:id` GET)
- Create: `alumni-backend/src/routes/batchGallery.js`; mount in `src/server.js` as `/api/batch-gallery`
- Test: `alumni-backend/tests/eventPhotos.test.js`, create `alumni-backend/tests/batchGallery.test.js`
- Create: `alumni-frontend/src/pages/AdminBatchGallery.jsx`
- Modify: `alumni-frontend/src/App.jsx` (route `/admin/batch-gallery`, nav item)

**Interfaces:**
- Produces: `GET /api/events/recap` → `{ event: {id,title,event_date,location?} | null, photos: [{id,media,media_type}] }` for the most recent past event with `batch_id IS NULL` that has at least one photo (max 6 photos). Mirrors the filter used by `/highlights`.
- Produces: `GET /api/batch-gallery?batch_id=<n>` (public; `batch_id` optional, limit 24, newest first) → `{ photos: [{id,batch_id,batch_name,media,caption}] }`; `POST /` (admin, body `{batch_id, media, caption?}`, 400 if missing, 404 if batch not found) → 201 `{ photo }`; `DELETE /:id` (admin) → 204, 404 if absent.

- [ ] **Step 1: Write failing tests**: recap returns `event: null, photos: []` when empty; returns the newest past public event with photos and ignores a batch-scoped event that has photos; batch-gallery public list filters by `batch_id`; alumni POST is 403; admin POST without `media` is 400; admin POST/DELETE round trip.
- [ ] **Step 2: Run** `npm test -- eventPhotos batchGallery` → FAIL.
- [ ] **Step 3: Implement** `/recap` and `batchGallery.js` router following `partners.js` style; mount the router.
- [ ] **Step 4: Run** `npm test -- eventPhotos batchGallery` → PASS.
- [ ] **Step 5: Build `AdminBatchGallery`**: batch select (from `GET /batches`), multi-file upload (resize `maxDim: 1600`), grid of existing photos for the chosen batch with delete.
- [ ] **Step 6: Verify** frontend lint + build pass.

### Task 5: Projects

**Files:**
- Create: `alumni-backend/src/routes/projects.js`; mount at `/api/projects`
- Test: `alumni-backend/tests/projects.test.js`
- Create: `alumni-frontend/src/pages/AdminProjects.jsx`, `alumni-frontend/src/pages/ProjectDetail.jsx`
- Modify: `alumni-frontend/src/App.jsx` (routes `/projects/:id` public, `/admin/projects`; nav item)

**Interfaces:**
- Produces: `GET /api/projects?featured=true` (public; `featured=true` filters; newest first) → `{ projects }`; `GET /:id` → `{ project }` (with `batch_name`), 404 on bad id; `POST /` and `PATCH /:id` (admin; fields `title, summary, description, image, batch_id, lead_name, featured`; `title` required on POST); `DELETE /:id` → 204.

- [ ] **Step 1: Write failing tests**: public list empty; alumni POST 403; POST without title 400; admin create + `featured=true` filter only returns featured; PATCH toggles `featured`; GET `/abc` and unknown id 404; DELETE removes.
- [ ] **Step 2: Run** `npm test -- projects` → FAIL.
- [ ] **Step 3: Implement** `projects.js` (build the PATCH `SET` clause from an allowed-column list, as `school.js` does).
- [ ] **Step 4: Run** `npm test -- projects` → PASS.
- [ ] **Step 5: Build `AdminProjects`** (form + list with a featured toggle and delete) and `ProjectDetail`.
- [ ] **Step 6: Verify** frontend lint + build pass.

### Task 6: Alumni stories (Faces Behind the Success)

**Files:**
- Create: `alumni-backend/src/routes/alumniStories.js`; mount at `/api/alumni-stories`
- Test: `alumni-backend/tests/alumniStories.test.js`
- Create: `alumni-frontend/src/pages/AdminAlumniStories.jsx`, `alumni-frontend/src/pages/AlumniStoryDetail.jsx`
- Modify: `alumni-frontend/src/App.jsx` (routes `/alumni-stories/:id` public, `/admin/alumni-stories`; nav item)

**Interfaces:**
- Produces: same shape as Task 5 for `alumni_stories`: `GET /?featured=true`, `GET /:id`, `POST` (admin; `name` required; fields `name, batch_label, role_title, photo, quote, story, featured`), `PATCH /:id`, `DELETE /:id`; responses keyed `stories` / `story`.

- [ ] **Step 1: Write failing tests** mirroring Task 5 (403 for alumni, 400 without `name`, featured filter, 404 on bad id, delete).
- [ ] **Step 2: Run** `npm test -- alumniStories` → FAIL.
- [ ] **Step 3: Implement** `alumniStories.js` like `projects.js`.
- [ ] **Step 4: Run** `npm test -- alumniStories` → PASS.
- [ ] **Step 5: Build the admin page and `AlumniStoryDetail`** (photo, name, batch, role, quote, full story). Photo resize `maxDim: 800`.
- [ ] **Step 6: Verify** frontend lint + build pass.

### Task 7: Sponsorship page and inquiries

**Files:**
- Create: `alumni-backend/src/routes/sponsor.js`; mount at `/api/sponsor`
- Test: `alumni-backend/tests/sponsor.test.js`
- Create: `alumni-frontend/src/pages/Sponsor.jsx`, `alumni-frontend/src/pages/AdminSponsorInquiries.jsx`
- Modify: `alumni-frontend/src/App.jsx` (routes `/sponsor` public, `/admin/sponsor-inquiries`; nav item)

**Interfaces:**
- Produces: `POST /api/sponsor/inquiries` (public; body `{name,email,organization?,message?}`; 400 if `name` missing or `email` fails a basic `/^\S+@\S+\.\S+$/` check; 201 `{ ok: true }`); `GET /api/sponsor/inquiries` (admin) → `{ inquiries }` newest first; `DELETE /api/sponsor/inquiries/:id` (admin) → 204.

- [ ] **Step 1: Write failing tests**: missing name 400; bad email 400; valid submit 201 without auth; alumni and anonymous GET list are 403/401; admin list contains the submission; delete works.
- [ ] **Step 2: Run** `npm test -- sponsor` → FAIL.
- [ ] **Step 3: Implement** `sponsor.js`.
- [ ] **Step 4: Run** `npm test -- sponsor` → PASS.
- [ ] **Step 5: Build `Sponsor`** (intro, a short benefits list, inquiry form with success/error state) and `AdminSponsorInquiries` (list + delete). Package/benefit copy is placeholder text the admin can ask to change later; keep it generic.
- [ ] **Step 6: Verify** frontend lint + build pass.

### Task 8: Recompose the homepage

**Files:**
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`
- Create in `alumni-frontend/src/components/home/` (overwrite the same-named placeholder files where they exist): `Overview.jsx`, `AnnouncementsSection.jsx`, `RecapGallery.jsx`, `ProjectsSection.jsx`, `AlumniFaces.jsx`, `SponsorBand.jsx`, `Partnerships.jsx`
- Delete: unused placeholder components in `components/home/` that nothing imports after this task (check with grep before deleting): `AlumniStories.jsx`, `FeaturedAlumni.jsx`, `AlumniImpact.jsx`, `GiveBack.jsx`, `SchoolMemories.jsx`, `AlumniEventsSection.jsx`, `AlumniIntro.jsx`, `BatchExplorer.jsx`, `OfficersPreview.jsx`, `PresidentMessage.jsx`.

**Interfaces:**
- Consumes: `/public-stats`, `useAuth().school` (`overview_title/body/image`), `/announcements` (first 3), `/events/recap`, `/batch-gallery`, `/batches` (for gallery filter tabs), `/projects?featured=true`, `/alumni-stories?featured=true`, `/partners`.
- Each section component takes its data as props (`{ items }`-style) and returns `null` when empty, except Overview (always shown, falls back to a default reconnecting message) and SponsorBand (static).
- Cards are `<Link>`s: announcement → `/announcements/:id`; recap → `/events/:id`; gallery photo opens the existing `Lightbox`; project → `/projects/:id`; face → `/alumni-stories/:id`; partner logo → `website_url` in a new tab with `rel="noopener noreferrer"` (plain `<div>` when there is no URL); SponsorBand → `/sponsor`.

- [ ] **Step 1: Build the section components** per the interfaces above. `Overview` renders title, body, optional image, and the four `/public-stats` numbers as the "proof of life" row. `RecapGallery` shows the recap event card plus batch tabs (All + each batch) filtering the batch gallery grid, cap 12 photos.
- [ ] **Step 2: Rewrite `PublicHome.jsx`**: keep the hero block untouched; fetch the data listed above; render sections in the Global Constraints order; keep the final Join CTA band, `Lightbox` and `ChatWidget`. Remove the old stats strip, batches, and events sections.
- [ ] **Step 3: Grep and delete** the placeholder components listed above that have no remaining importers.
- [ ] **Step 4: Verify** `npm run lint && npm run build` in `alumni-frontend`, then `cd ../alumni-backend && npm test` (whole suite) all pass.
- [ ] **Step 5: Verify in the browser** (dev servers up; use the Playwright or Chrome tools): empty database state shows hero, Overview, Sponsorship, Join band with no errors or fake content; after creating one item of each type via the admin pages, every section appears in order and every card navigates to a working detail page; check the console for errors and a 375px mobile width.
