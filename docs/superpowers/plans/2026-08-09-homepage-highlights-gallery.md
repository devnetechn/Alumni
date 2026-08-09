# Homepage Highlights Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins/officers can upload photos or short videos to a past event; the public homepage shows a "Highlights" gallery pooling the most recent past-event media, no login required.

**Architecture:** A new `event_photos` table (one row per photo/video, data-URL-in-Postgres, same pattern as `users.profile_pic`) backs a small CRUD router. A new public `GET /events/highlights` endpoint (behind `resolveTenant` but not `requireAuth`) feeds a new homepage section. A shared frontend helper (`src/lib/media.js`) replaces the third copy-paste of the existing image-resize logic and is also used by the new upload UI.

**Tech Stack:** Express + `pg` (backend), React (frontend), Jest + Supertest (backend tests). No new dependencies.

## Global Constraints

- Upload cap is 10MB per source file (image or video), enforced client-side before any resize/read.
- Images are resized/compressed client-side (canvas, same as today); videos are stored as uploaded — no client-side video transcoding.
- `POST`/`DELETE`/per-event `GET /:id/photos` require `requireOfficer` (same tier as check-in scanning). `GET /highlights` requires no auth at all.
- `GET /highlights` returns only media from events where `event_date < now()`, newest-media-first, capped at 12 rows.
- The homepage Highlights section renders nothing at all (not even a placeholder) when there is no past-event media yet.
- `Profile.jsx` and `Register.jsx`'s existing upload behavior (2MB cap, 400px resize, JPEG quality 0.85) must not change — only their implementation moves to the shared helper.

---

### Task 1: Database — `event_photos` table

**Files:**
- Modify: `alumni-backend/db/schema.sql`
- Modify: `alumni-backend/tests/helpers.js`
- Modify: `alumni-backend/tests/schema.test.js`

**Interfaces:**
- Produces: `event_photos(id, school_id, event_id, media, media_type, uploaded_by, created_at)`, RLS-protected like every other tenant table, granted to `alumni_app`. Consumed by Task 2's routes.

- [ ] **Step 1: Write the failing tests**

In `alumni-backend/tests/schema.test.js`, update the two hardcoded table-list assertions to include `event_photos` (it must be inserted alphabetically — the list is sorted):

```js
test('all expected tables exist after migration', async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const names = rows.map((r) => r.table_name).sort();
  expect(names).toEqual([
    'announcements', 'event_checkins', 'event_photos', 'event_rsvps', 'events',
    'group_members', 'group_posts', 'groups', 'jobs',
    'messages', 'notifications', 'platform_admins', 'processed_webhook_events', 'schools', 'users',
  ]);
});
```

And add `'event_photos'` to the tables arrays in both `'every tenant table has a school_id column'` and `'every tenant table has row-level security enabled'`:

```js
test('every tenant table has a school_id column', async () => {
  const tables = [
    'users', 'events', 'event_rsvps', 'event_checkins', 'event_photos', 'jobs',
    'announcements', 'messages', 'groups', 'group_members', 'group_posts', 'notifications',
  ];
  // ... unchanged body
});

test('every tenant table has row-level security enabled', async () => {
  const tables = [
    'users', 'events', 'event_rsvps', 'event_checkins', 'event_photos', 'jobs',
    'announcements', 'messages', 'groups', 'group_members', 'group_posts', 'notifications',
  ];
  // ... unchanged body
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/schema.test.js --runInBand`
Expected: FAIL — `event_photos` doesn't exist yet, so the table-list assertion mismatches and the school_id/RLS loops find zero rows for it.

- [ ] **Step 3: Add the table to `schema.sql`**

Append to the end of `alumni-backend/db/schema.sql` (after the existing `processed_webhook_events` table definition):

```sql
CREATE TABLE IF NOT EXISTS event_photos (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  media TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON event_photos;
CREATE POLICY tenant_isolation ON event_photos
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

GRANT ALL ON event_photos, event_photos_id_seq TO alumni_app;
```

- [ ] **Step 4: Add `event_photos` to `resetDb()`'s TRUNCATE list**

In `alumni-backend/tests/helpers.js`, change:

```js
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_checkins, event_rsvps, events, users, schools, platform_admins,
      processed_webhook_events
    RESTART IDENTITY CASCADE
```

to:

```js
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_photos, event_checkins, event_rsvps, events, users, schools, platform_admins,
      processed_webhook_events
    RESTART IDENTITY CASCADE
```

- [ ] **Step 5: Run the migration and the tests**

Run (PowerShell): `Set-Location alumni-backend; node scripts/migrate.js; node scripts/migrate.js` (run twice — confirms the `CREATE TABLE IF NOT EXISTS` / `DROP POLICY IF EXISTS` are safely idempotent, matching every other table in this file)
Expected: `Migration complete.` both times, no errors.

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/schema.test.js --runInBand`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/tests/helpers.js alumni-backend/tests/schema.test.js
git commit -m "feat(backend): add event_photos table"
```

---

### Task 2: Backend — event photo routes

**Files:**
- Create: `alumni-backend/src/routes/eventPhotos.js`
- Modify: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/eventPhotos.test.js`

**Interfaces:**
- Consumes: `event_photos` table (Task 1), `requireAuth`/`requireOfficer` from `alumni-backend/src/middleware/auth.js`, `asyncHandler` from `alumni-backend/src/lib/asyncHandler.js`.
- Produces:
  - `POST /api/events/:id/photos` — body `{ media, media_type }`, 201 `{ photo: {...} }`.
  - `GET /api/events/:id/photos` — 200 `{ photos: [...] }`, newest first.
  - `DELETE /api/events/:id/photos/:photoId` — 204.
  - `GET /api/events/highlights` — no auth, 200 `{ highlights: [{ id, media, media_type, created_at, event_title, event_date }, ...] }`, past events only, newest first, max 12. Consumed by Task 6's frontend.

- [ ] **Step 1: Write the failing tests**

Create `alumni-backend/tests/eventPhotos.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeEvent({ pastEvent = true } = {}) {
  const school = await getDefaultSchool();
  const eventDate = pastEvent ? '2020-01-01T18:00:00Z' : '2099-01-01T18:00:00Z';
  const rows = await pool.query(
    `INSERT INTO events (school_id, title, event_date) VALUES ($1,$2,$3) RETURNING id`,
    [school.id, pastEvent ? 'Old Gala' : 'Future Gala', eventDate]
  );
  return rows.rows[0].id;
}

test('POST /:id/photos requires officer/admin', async () => {
  const eventId = await makeEvent();
  const plainAlumni = await insertUser();

  const res = await request(app)
    .post(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(plainAlumni))
    .send({ media: 'data:image/jpeg;base64,AAAA', media_type: 'image' });

  expect(res.status).toBe(403);
});

test('POST /:id/photos creates a photo row for an officer', async () => {
  const eventId = await makeEvent();
  const officer = await insertUser({ is_batch_leader: true });

  const res = await request(app)
    .post(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:image/jpeg;base64,AAAA', media_type: 'image' });

  expect(res.status).toBe(201);
  expect(res.body.photo.media_type).toBe('image');

  const list = await request(app)
    .get(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer));
  expect(list.body.photos.length).toBe(1);
});

test('DELETE /:id/photos/:photoId removes a photo, scoped to the right event', async () => {
  const eventId = await makeEvent();
  const otherEventId = await makeEvent();
  const officer = await insertUser({ is_batch_leader: true });

  const created = await request(app)
    .post(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:video/mp4;base64,AAAA', media_type: 'video' });
  const photoId = created.body.photo.id;

  const wrongScope = await request(app)
    .delete(`/api/events/${otherEventId}/photos/${photoId}`)
    .set('Authorization', authHeader(officer));
  expect(wrongScope.status).toBe(404);

  const rightScope = await request(app)
    .delete(`/api/events/${eventId}/photos/${photoId}`)
    .set('Authorization', authHeader(officer));
  expect(rightScope.status).toBe(204);

  const list = await request(app)
    .get(`/api/events/${eventId}/photos`)
    .set('Authorization', authHeader(officer));
  expect(list.body.photos.length).toBe(0);
});

test('GET /highlights requires no auth and only returns past-event media', async () => {
  const pastEventId = await makeEvent({ pastEvent: true });
  const futureEventId = await makeEvent({ pastEvent: false });
  const officer = await insertUser({ is_batch_leader: true });

  await request(app)
    .post(`/api/events/${pastEventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:image/jpeg;base64,PAST', media_type: 'image' });
  await request(app)
    .post(`/api/events/${futureEventId}/photos`)
    .set('Authorization', authHeader(officer))
    .send({ media: 'data:image/jpeg;base64,FUTURE', media_type: 'image' });

  const res = await request(app).get('/api/events/highlights');

  expect(res.status).toBe(200);
  expect(res.body.highlights.length).toBe(1);
  expect(res.body.highlights[0].media).toBe('data:image/jpeg;base64,PAST');
  expect(res.body.highlights[0].event_title).toBe('Old Gala');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/eventPhotos.test.js --runInBand`
Expected: FAIL — `Cannot GET /api/events/.../photos` (404), route doesn't exist yet.

- [ ] **Step 3: Create the router**

Create `alumni-backend/src/routes/eventPhotos.js`:

```js
const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { requireAuth, requireOfficer } = require('../middleware/auth');

const router = express.Router();

router.post('/:id/photos', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const { media, media_type } = req.body;
  if (!media || !['image', 'video'].includes(media_type)) {
    return res.status(400).json({ error: 'media and a valid media_type (image or video) are required' });
  }
  const rows = await req.db(
    `INSERT INTO event_photos (school_id, event_id, media, media_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.school.id, req.params.id, media, media_type, req.user.id]
  );
  res.status(201).json({ photo: rows[0] });
}));

router.get('/:id/photos', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT * FROM event_photos WHERE event_id = $1 ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json({ photos: rows });
}));

router.delete('/:id/photos/:photoId', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `DELETE FROM event_photos WHERE id = $1 AND event_id = $2 RETURNING id`,
    [req.params.photoId, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
  res.status(204).end();
}));

router.get('/highlights', asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT ep.id, ep.media, ep.media_type, ep.created_at, e.title AS event_title, e.event_date
     FROM event_photos ep
     JOIN events e ON e.id = ep.event_id
     WHERE e.event_date < now()
     ORDER BY ep.created_at DESC
     LIMIT 12`
  );
  res.json({ highlights: rows });
}));

module.exports = router;
```

- [ ] **Step 4: Mount the router**

In `alumni-backend/src/server.js`, right after the existing `app.use('/api/events', eventsRoutes);` line, add:

```js
const eventPhotosRoutes = require('./routes/eventPhotos');
app.use('/api/events', eventPhotosRoutes);
```

- [ ] **Step 5: Raise the JSON body limit for the 10MB upload**

In `alumni-backend/src/server.js`, change:

```js
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
```

to:

```js
app.use(express.json({
  limit: '15mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/eventPhotos.test.js --runInBand`
Expected: all 4 tests PASS.

- [ ] **Step 7: Run the full backend suite**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest --runInBand`
Expected: all suites PASS (no regressions from the body-limit change).

- [ ] **Step 8: Commit**

```bash
git add alumni-backend/src/routes/eventPhotos.js alumni-backend/src/server.js alumni-backend/tests/eventPhotos.test.js
git commit -m "feat(backend): add event photo upload/delete routes and public highlights endpoint"
```

---

### Task 3: Frontend — shared media helper, refactor existing upload UIs

**Files:**
- Create: `alumni-frontend/src/lib/media.js`
- Modify: `alumni-frontend/src/pages/Profile.jsx`
- Modify: `alumni-frontend/src/pages/Register.jsx`

**Interfaces:**
- Produces: `validateFile(file, maxBytes) => string | null`, `resizeImage(file, { maxDim, quality }) => Promise<string>`, `readAsDataUrl(file) => Promise<string>`. Consumed by Task 5's upload UI.

- [ ] **Step 1: Create the helper**

Create `alumni-frontend/src/lib/media.js`:

```js
export function validateFile(file, maxBytes) {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return 'Please select an image or video file';
  }
  if (file.size > maxBytes) {
    return `File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`;
  }
  return null;
}

export function resizeImage(file, { maxDim = 400, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (ev) => resolve(ev.target.result);
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Refactor `Profile.jsx` to use it**

In `alumni-frontend/src/pages/Profile.jsx`, add the import:

```jsx
import { validateFile, resizeImage } from '../lib/media';
```

Replace the existing `onFile` handler body:

```jsx
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please select an image file' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Image too large (max 2MB)' });
      return;
    }
    // Resize to max 400px for avatar — keeps DB rows small
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setForm((f) => ({ ...f, profile_pic: dataUrl }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
```

with:

```jsx
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file, 2 * 1024 * 1024);
    if (err) {
      setMsg({ type: 'err', text: err });
      return;
    }
    const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
    setForm((f) => ({ ...f, profile_pic: dataUrl }));
  };
```

(`validateFile` accepts image or video; `Profile.jsx`'s photo picker should stay image-only, so keep this explicit check right after it in the same function:)

```jsx
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please select an image file' });
      return;
    }
    const err = validateFile(file, 2 * 1024 * 1024);
    if (err) {
      setMsg({ type: 'err', text: err });
      return;
    }
    const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
    setForm((f) => ({ ...f, profile_pic: dataUrl }));
  };
```

- [ ] **Step 3: Refactor `Register.jsx` to use it**

In `alumni-frontend/src/pages/Register.jsx`, add the import:

```jsx
import { validateFile, resizeImage } from '../lib/media';
```

Replace the `onFile` handler (added in the required-registration-photo work) with the same pattern:

```jsx
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Please select an image file');
      return;
    }
    const err = validateFile(file, 2 * 1024 * 1024);
    if (err) {
      setErr(err);
      return;
    }
    const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
    setForm((f) => ({ ...f, profile_pic: dataUrl }));
  };
```

- [ ] **Step 4: Lint**

Run (PowerShell): `Set-Location alumni-frontend; npx eslint src/lib/media.js src/pages/Profile.jsx src/pages/Register.jsx`
Expected: no new errors.

- [ ] **Step 5: Build**

Run (PowerShell): `Set-Location alumni-frontend; npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification — no behavior change**

Start both dev servers. On `/profile`, upload a photo — confirm it still resizes/previews/saves exactly as before. On `/register`, upload a photo — confirm the same. Both should look and behave identically to before this refactor.

- [ ] **Step 7: Commit**

```bash
git add alumni-frontend/src/lib/media.js alumni-frontend/src/pages/Profile.jsx alumni-frontend/src/pages/Register.jsx
git commit -m "refactor(frontend): extract shared image resize/validate helper"
```

---

### Task 4: Frontend — admin Photos section on the per-event page

**Files:**
- Modify: `alumni-frontend/src/pages/EventCheckin.jsx`

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/events/:id/photos` (Task 2), `validateFile`/`resizeImage`/`readAsDataUrl` from `src/lib/media.js` (Task 3).

- [ ] **Step 1: Add state, load, and upload/delete handlers**

In `alumni-frontend/src/pages/EventCheckin.jsx`, add imports:

```jsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Download, QrCode, Upload, Trash2 } from 'lucide-react';
import { api, API_BASE } from '../api';
import { Panel, Button, Badge } from '../components/ui';
import { useAuth } from '../auth';
import AlumniScanner from '../components/AlumniScanner';
import { validateFile, resizeImage, readAsDataUrl } from '../lib/media';
```

Add state and handlers alongside the existing `attendance`/`event` state (`canvasRef` stays where it is):

```jsx
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);

  const loadPhotos = () => api.get(`/events/${id}/photos`).then((r) => setPhotos(r.data.photos));

  const onPhotoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file, 10 * 1024 * 1024);
    if (err) {
      alert(err);
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const media = isVideo ? await readAsDataUrl(file) : await resizeImage(file, { maxDim: 1200, quality: 0.8 });
    await api.post(`/events/${id}/photos`, { media, media_type: isVideo ? 'video' : 'image' });
    e.target.value = '';
    loadPhotos();
  };

  const deletePhoto = async (photoId) => {
    if (!confirm('Delete this photo/video?')) return;
    await api.delete(`/events/${id}/photos/${photoId}`);
    loadPhotos();
  };
```

Add `loadPhotos()` to the existing data-loading `useEffect`:

```jsx
  useEffect(() => {
    api.get(`/events/${id}`).then((r) => setEvent(r.data.event)).catch(() => {});
    loadAttendance();
    loadPhotos();
  }, [id]);
```

- [ ] **Step 2: Add the Photos section JSX**

Insert right after the closing `{isOfficer && <AlumniScanner eventId={id} onCheckedIn={loadAttendance} />}` line and before the Attendance List `<Panel className="overflow-hidden">`:

```jsx
      {isOfficer && (
        <Panel className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[var(--brand-ink)]">Photos</h2>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onPhotoFile} />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Upload Photo/Video
            </Button>
          </div>
          {photos.length === 0 ? (
            <p className="text-sm text-slate-500">No photos or videos yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="relative rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)] aspect-square">
                  {p.media_type === 'video' ? (
                    <video src={p.media} className="w-full h-full object-cover" preload="metadata" />
                  ) : (
                    <img src={p.media} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => deletePhoto(p.id)}
                    className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 border-2 border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-danger)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
```

- [ ] **Step 3: Lint**

Run (PowerShell): `Set-Location alumni-frontend; npx eslint src/pages/EventCheckin.jsx`
Expected: no new errors.

- [ ] **Step 4: Build**

Run (PowerShell): `Set-Location alumni-frontend; npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

Start both dev servers, log in as an admin/officer, open a past event's check-in page. Upload a photo — confirm it appears in the grid. Upload a short video — confirm it shows a thumbnail (first frame). Delete one — confirm it disappears.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/pages/EventCheckin.jsx
git commit -m "feat(frontend): add photo/video upload to the event check-in admin page"
```

---

### Task 5: Frontend — homepage Highlights gallery

**Files:**
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `GET /api/events/highlights` (Task 2), unauthenticated.

- [ ] **Step 1: Fetch highlights and add lightbox state**

In `alumni-frontend/src/pages/PublicHome.jsx`, add to the imports:

```jsx
import { GraduationCap, Megaphone, Calendar, MapPin, ArrowRight, Sparkles, X, Play } from 'lucide-react';
```

Add state and a fetch call alongside the existing ones:

```jsx
  const [highlights, setHighlights] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api.get('/announcements').then((r) => setAnnouncements(r.data.announcements));
    api.get('/events').then((r) => setEvents(r.data.events));
    api.get('/stats').then((r) => setStats(r.data));
    api.get('/events/highlights').then((r) => setHighlights(r.data.highlights));
  }, []);
```

- [ ] **Step 2: Add the Highlights section**

Insert a new `motion.section` right after the closing `</motion.section>` of the Events section and before the `{/* CTA */}` comment:

```jsx
      {/* Highlights */}
      {highlights.length > 0 && (
        <motion.section
          className="max-w-7xl mx-auto px-6 py-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionFade}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)]">
              <Sparkles className="text-white" size={22} />
            </div>
            <h2 className="font-display text-3xl text-[var(--brand-ink)]">
              Highlights
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {highlights.map((h, i) => (
              <motion.button
                key={h.id}
                type="button"
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={cardFade}
                onClick={() => setLightbox(h)}
                className="group relative aspect-square rounded-[var(--radius)] overflow-hidden border-[2.5px] border-[var(--brand-ink)] hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow text-left"
              >
                {h.media_type === 'video' ? (
                  <>
                    <video src={h.media} className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="text-white" fill="white" size={32} />
                    </div>
                  </>
                ) : (
                  <img src={h.media} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                  {h.event_title} · {new Date(h.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}
```

- [ ] **Step 3: Add the lightbox**

Insert right before the closing `<ChatWidget />` at the end of the component:

```jsx
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white p-2"
            >
              <X size={24} />
            </button>
            {lightbox.media_type === 'video' ? (
              <video src={lightbox.media} className="w-full rounded-[var(--radius)]" controls autoPlay />
            ) : (
              <img src={lightbox.media} alt="" className="w-full rounded-[var(--radius)]" />
            )}
            <p className="text-white text-sm mt-3 text-center">
              {lightbox.event_title} · {new Date(lightbox.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      <ChatWidget />
```

- [ ] **Step 4: Lint**

Run (PowerShell): `Set-Location alumni-frontend; npx eslint src/pages/PublicHome.jsx`
Expected: no new errors.

- [ ] **Step 5: Build**

Run (PowerShell): `Set-Location alumni-frontend; npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification**

With at least one photo and one video uploaded to a past event (from Task 4's manual check), open the public homepage (logged out). Confirm the Highlights section appears with both items, captioned with event title/date. Confirm the video thumbnail does not autoplay on page load. Click the video — confirm the lightbox opens and plays with controls. Click a photo — confirm it opens full-size in the lightbox. Click outside the lightbox or the X — confirm it closes. As a final check, temporarily rename/hide all event_photos rows for a school with none (or check a fresh school with no past events) and confirm the section doesn't render at all.

- [ ] **Step 7: Commit**

```bash
git add alumni-frontend/src/pages/PublicHome.jsx
git commit -m "feat(frontend): add homepage highlights gallery with lightbox"
```
