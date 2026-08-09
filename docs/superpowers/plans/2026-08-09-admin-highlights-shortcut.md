# Admin Highlights Shortcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Highlights" sidebar nav item (admin-visible) opens a page for picking a past event and managing its photos/videos directly — without going through Events → Check-in first. The existing Photos section on the check-in page keeps working unchanged.

**Architecture:** The Photos section already built into `EventCheckin.jsx` gets extracted into a standalone `EventPhotosManager` component (pure extraction, no behavior change), then reused by both `EventCheckin.jsx` and a new `AdminHighlights.jsx` page that lists past events and lets the admin pick one.

**Tech Stack:** React. No new dependencies. `AdminHighlights.jsx` follows the same "fetch events, render as clickable Panel cards" pattern already used by `alumni-frontend/src/pages/ScanRedirect.jsx`.

## Global Constraints

- The Photos section's behavior (upload, 10MB cap, resize-for-images/store-as-is-for-video, delete, thumbnail grid) must not change — only its location in the code changes.
- The new nav item follows the exact same visibility convention already used by `'Scan'`/`'Manage Posts'`/`'Users'` in `alumni-frontend/src/App.jsx`'s `navItems` (`adminOnly: true`).

---

### Task 1: Extract `EventPhotosManager`

**Files:**
- Create: `alumni-frontend/src/components/EventPhotosManager.jsx`
- Modify: `alumni-frontend/src/pages/EventCheckin.jsx`

**Interfaces:**
- Produces: `<EventPhotosManager eventId={id} />` — self-contained, fetches and manages its own photos for the given event. Consumed by Task 2's new page.

- [ ] **Step 1: Create the component**

Create `alumni-frontend/src/components/EventPhotosManager.jsx`, moving the Photos state/handlers/JSX out of `EventCheckin.jsx` verbatim:

```jsx
import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Panel, Button } from './ui';
import { validateFile, resizeImage, readAsDataUrl } from '../lib/media';

export default function EventPhotosManager({ eventId }) {
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);

  const loadPhotos = () => api.get(`/events/${eventId}/photos`).then((r) => setPhotos(r.data.photos));

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

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
    await api.post(`/events/${eventId}/photos`, { media, media_type: isVideo ? 'video' : 'image' });
    e.target.value = '';
    loadPhotos();
  };

  const deletePhoto = async (photoId) => {
    if (!confirm('Delete this photo/video?')) return;
    await api.delete(`/events/${eventId}/photos/${photoId}`);
    loadPhotos();
  };

  return (
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
  );
}
```

- [ ] **Step 2: Refactor `EventCheckin.jsx` to use it**

In `alumni-frontend/src/pages/EventCheckin.jsx`:

Remove the `photos` state, `loadPhotos`/`onPhotoFile`/`deletePhoto` handlers, the `fileRef`, and the `Upload`/`Trash2` icon imports and `validateFile`/`resizeImage`/`readAsDataUrl` import (no longer used directly in this file). Remove `loadPhotos()` from the data-loading `useEffect`. Add the import:

```jsx
import EventPhotosManager from '../components/EventPhotosManager';
```

Replace the inline Photos `Panel` block:

```jsx
      {isOfficer && (
        <Panel className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[var(--brand-ink)]">Photos</h2>
            ...
          </div>
          ...
        </Panel>
      )}
```

with:

```jsx
      {isOfficer && <EventPhotosManager eventId={id} />}
```

The resulting top of the file should look like:

```jsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';
import { api, API_BASE } from '../api';
import { Panel, Button, Badge } from '../components/ui';
import { useAuth } from '../auth';
import AlumniScanner from '../components/AlumniScanner';
import EventPhotosManager from '../components/EventPhotosManager';

export default function EventCheckin() {
  const { id } = useParams();
  const { user } = useAuth();
  const isOfficer = user?.role === 'admin' || user?.is_batch_leader;
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const canvasRef = useRef(null);

  const loadAttendance = () => api.get(`/events/${id}/checkin`).then((r) => setAttendance(r.data.attendance));

  useEffect(() => {
    api.get(`/events/${id}`).then((r) => setEvent(r.data.event)).catch(() => {});
    loadAttendance();
  }, [id]);
```

(the rest of the file — the second `useEffect` for the QR canvas, and the JSX — is unchanged except for the Photos block replacement above).

- [ ] **Step 3: Lint**

Run (PowerShell): `Set-Location alumni-frontend; npx eslint src/components/EventPhotosManager.jsx src/pages/EventCheckin.jsx`
Expected: no new errors.

- [ ] **Step 4: Build**

Run (PowerShell): `Set-Location alumni-frontend; npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification — no behavior change**

Start both dev servers. On a past event's check-in page (e.g. `/events/5/checkin`), confirm the Photos section still works exactly as before: upload, thumbnail grid, delete.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/components/EventPhotosManager.jsx alumni-frontend/src/pages/EventCheckin.jsx
git commit -m "refactor(frontend): extract EventPhotosManager from EventCheckin"
```

---

### Task 2: `AdminHighlights` page, route, and nav item

**Files:**
- Create: `alumni-frontend/src/pages/AdminHighlights.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `EventPhotosManager` (Task 1), `GET /api/events` (existing, unauthenticated-safe but called here while logged in).

- [ ] **Step 1: Create the page**

Create `alumni-frontend/src/pages/AdminHighlights.jsx`, modeled on the existing "fetch events, render as clickable cards" pattern in `alumni-frontend/src/pages/ScanRedirect.jsx`, but filtering to **past** events and rendering the selected event's `EventPhotosManager` below the list:

```jsx
import { useEffect, useState } from 'react';
import { Sparkles, Calendar } from 'lucide-react';
import { api } from '../api';
import { Panel } from '../components/ui';
import EventPhotosManager from '../components/EventPhotosManager';

export default function AdminHighlights() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/events').then((r) => {
      const now = new Date();
      const past = r.data.events
        .filter((e) => new Date(e.event_date) < now)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
      setEvents(past);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Sparkles className="text-[var(--brand-accent)]" /> Highlights
        </h1>
        <p className="text-slate-500 mt-1">Pick a past event to manage its photos and videos.</p>
      </div>

      {loading && <div className="text-slate-500">Loading events...</div>}

      <div className="space-y-3 mb-8">
        {events.map((ev) => (
          <Panel
            key={ev.id}
            as="button"
            onClick={() => setSelected(ev)}
            className={`w-full text-left p-5 hover:shadow-[4px_4px_0_var(--brand-accent)] hover:border-[var(--brand-accent)] transition-all ${
              selected?.id === ev.id ? 'shadow-[4px_4px_0_var(--brand-accent)] border-[var(--brand-accent)]' : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-3 rounded-[var(--radius)]">
                <Calendar className="text-white" size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[var(--brand-ink)]">{ev.title}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(ev.event_date).toLocaleDateString()} {ev.location ? `· ${ev.location}` : ''}
                </p>
              </div>
            </div>
          </Panel>
        ))}
        {!loading && events.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            No past events yet.
          </Panel>
        )}
      </div>

      {selected && <EventPhotosManager eventId={selected.id} />}
    </div>
  );
}
```

- [ ] **Step 2: Add the route and nav item**

In `alumni-frontend/src/App.jsx`, add the import:

```jsx
import AdminHighlights from './pages/AdminHighlights';
```

Add to `navItems`, next to `'Manage Posts'`/`'Users'`:

```jsx
  { to: '/admin/highlights', label: 'Highlights', icon: Sparkles, adminOnly: true },
```

(add `Sparkles` to the existing `lucide-react` import list at the top of the file if not already imported there).

Add the route next to the other `/admin/*` routes:

```jsx
        <Route path="/admin/highlights" element={<Protected><AdminHighlights /></Protected>} />
```

- [ ] **Step 3: Lint**

Run (PowerShell): `Set-Location alumni-frontend; npx eslint src/pages/AdminHighlights.jsx src/App.jsx`
Expected: no new errors.

- [ ] **Step 4: Build**

Run (PowerShell): `Set-Location alumni-frontend; npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

As an admin, confirm "Highlights" appears in the sidebar. Click it — confirm it lists past events only (not future ones), pick one, upload a photo via this page, confirm it appears in the grid. Navigate to that same event's `/events/:id/checkin` page and confirm the same photo shows there too (proving both entry points share the same data). Log in as a plain alumnus and confirm "Highlights" does not appear in their sidebar.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/pages/AdminHighlights.jsx alumni-frontend/src/App.jsx
git commit -m "feat(frontend): add admin Highlights nav shortcut for managing event photos"
```
