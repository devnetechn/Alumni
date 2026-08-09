# Homepage highlights gallery (past-event photos/reels)

## Problem

The public homepage (`PublicHome.jsx`) shows Announcements and Upcoming Events, but nothing that celebrates what already happened — no way for a prospective or returning alumnus to see "what this community actually looks like" from past gatherings. There is also no concept of event media at all today: `events` has no photo/video field, and no table stores per-event media.

## Goal

Admins/officers can upload photos or short videos ("reels") to a past event from the existing per-event admin page. The public homepage shows a "Highlights" section — a gallery pooling the most recent media across past events, each captioned with its event's title/date — so visitors see real community moments without logging in.

## Non-goals

- No strict "exactly last calendar year" filtering — the section shows the most recent past-event media regardless of exact year, and simply doesn't render if there is none yet (see brainstorming discussion: avoids a permanently-empty section for schools new to the platform).
- No server-side video transcoding/compression — videos are stored as uploaded (subject to the 10MB cap), unlike photos which are still resized/compressed client-side.
- No editing of already-uploaded media (title/caption editing, reordering) — only upload and delete.
- No change to who can view the gallery — it's on the public homepage, same as Announcements/Events today (no auth required).

## Design

### Data model

New table, following the exact conventions every other tenant table in `db/schema.sql` already uses (school-scoped FK, RLS tenant-isolation policy):

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
```

`media` stores a data URL (`data:image/jpeg;base64,...` or `data:video/mp4;base64,...`), the same inline-in-Postgres pattern already used for `users.profile_pic` and `schools.logo` — no new storage system.

Also add `event_photos` to `resetDb()`'s TRUNCATE list in `alumni-backend/tests/helpers.js`.

### Shared upload helper (extracted, not duplicated a third time)

New file `alumni-frontend/src/lib/media.js`:

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

`Profile.jsx` and `Register.jsx` are refactored to call `validateFile(file, 2 * 1024 * 1024)` + `resizeImage(file, { maxDim: 400, quality: 0.85 })` instead of their inline copies of this logic — same constants, same resulting behavior, just de-duplicated. The new highlight-upload UI calls `validateFile(file, 10 * 1024 * 1024)`, then `resizeImage(...)` for images or `readAsDataUrl(file)` for videos (no resize path exists for video).

### Backend

`alumni-backend/src/server.js`: raise `express.json({ limit: '2mb', ... })` to `'15mb'` — a 10MB source file becomes roughly 13.3MB once base64-encoded inside the JSON body; 15MB leaves headroom.

New `alumni-backend/src/routes/eventPhotos.js`, mounted at `/api/events` in `server.js` alongside the existing events router (kept in its own file rather than added to `events.js`, which already handles events/rsvp/checkin/registrations):

- `POST /:id/photos` — `requireAuth, requireOfficer` (same tier as check-in scanning). Body: `{ media, media_type }`. Validates `media_type` is `'image'` or `'video'`, inserts a row.
- `GET /:id/photos` — `requireAuth, requireOfficer`. Lists photos for one event (admin view, newest first).
- `DELETE /:id/photos/:photoId` — `requireAuth, requireOfficer`. Deletes one row (scoped to the event via `WHERE id = $1 AND event_id = $2`).
- `GET /highlights` — **no auth**, mounted before `resolveTenant`'s allowlist isn't relevant here since this route still needs `req.school` to scope the query, so it stays behind `resolveTenant` but not `requireAuth`. Returns the most recent 12 rows across all *past* events (`events.event_date < now()`) for the current school, newest first, each joined with the event's `title` and `event_date`.

### Frontend: admin upload UI

New "Photos" section added to `alumni-frontend/src/pages/EventCheckin.jsx`, below the existing `AlumniScanner` block and above the Attendance List panel (visible to `isOfficer`, matching the scanner's own visibility gate). Grid of thumbnails (`<img>` for images, `<video>` with a poster frame for video items) each with a delete button; an upload button using the shared helper, wired to `POST /events/:id/photos`.

### Frontend: homepage gallery

`PublicHome.jsx` fetches `GET /events/highlights` alongside its existing `announcements`/`events`/`stats` calls. New section (same `motion.section` fade-in-on-scroll pattern as Announcements/Events), placed after the Events section and before the CTA. Grid of cards: images render directly; video items show the video element with `preload="metadata"` (renders the first frame as a poster, doesn't autoplay) plus a centered play-icon overlay — clicking opens a simple lightbox (a fixed-position overlay, same visual pattern as the delete-confirmation modal in `PlatformDashboard.jsx`) playing that one video with native `controls`. Each card is captioned with its event's title and date. If the highlights array is empty, the whole section doesn't render — no "no highlights yet" placeholder, since (per the brainstorming discussion) an empty state here is expected and common for schools new to the platform, not an error condition worth calling out.

## Testing

- Backend: `alumni-backend/tests/eventPhotos.test.js` — `POST /:id/photos` requires officer/admin (403 for a plain alumnus); creates a row with the right `media_type`; `DELETE` removes it and is scoped to the right event (can't delete another event's photo by guessing an ID); `GET /highlights` returns only past-event media, newest first, capped at 12, and excludes future-event media even if some exists.
- Frontend: lint + build on all touched files (`Profile.jsx`, `Register.jsx`, `EventCheckin.jsx`, `PublicHome.jsx`, new `media.js`).
- Manual: upload a photo and a short video to a past event, confirm both appear in the admin Photos section and (after refresh) on the public homepage; confirm clicking a video thumbnail opens the lightbox and plays with controls, autoplay does not happen on page load; confirm the section is absent entirely on a school with no past-event media.
