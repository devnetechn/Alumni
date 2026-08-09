# Admin Highlights shortcut (direct nav to photo management)

## Problem

Uploading event photos/videos (the homepage Highlights feature, shipped earlier today) only lives inside the per-event check-in page (`EventCheckin.jsx`), reached via Events → pick an event → Check-in. An admin who just wants to manage highlight media has to navigate through the scanner/attendance page to find it — it's not discoverable from the admin sidebar.

## Goal

A direct "Highlights" sidebar nav item (admin-visible, same convention as the existing "Scan"/"Manage Posts"/"Users" items) takes the admin straight to a page for picking a past event and managing its photos/videos — without needing to go through Events → Check-in first.

## Non-goals

- Not removing the Photos section from `EventCheckin.jsx` — it stays there too, since it's still convenient when already on that page. This is an additional entry point, not a relocation.
- Not changing the underlying upload/delete/highlights API from today's work — same `POST`/`GET`/`DELETE /events/:id/photos` routes.
- Not changing who can upload (`requireOfficer` on the backend, unchanged) — only nav-item *visibility* follows the existing `adminOnly` convention (which, like "Scan" today, only checks `user.role === 'admin'`, not `is_batch_leader` — a pre-existing gap in the nav filter, not something this work introduces or fixes).

## Design

### Extract `EventPhotosManager` component

New `alumni-frontend/src/components/EventPhotosManager.jsx`, accepting an `eventId` prop. Contains exactly what's currently inline in `EventCheckin.jsx`'s Photos section: the `photos` state, `loadPhotos`/`onPhotoFile`/`deletePhoto` handlers, and the upload-button + thumbnail-grid JSX. No behavior change — a pure extraction.

`EventCheckin.jsx` replaces its inline Photos section with `{isOfficer && <EventPhotosManager eventId={id} />}`.

### New page: pick-an-event-then-manage

New `alumni-frontend/src/pages/AdminHighlights.jsx`:
- Fetches `GET /events`, filters client-side to `event_date < now`, sorts newest-first.
- Renders that list (title + date, matching the visual style already used for event cards elsewhere in the app).
- Clicking an event selects it (local state); the selected event's `<EventPhotosManager eventId={selected.id} />` renders below the list.
- If there are no past events yet, shows a simple "No past events yet" message instead of an empty list.

### Routing and nav

`alumni-frontend/src/App.jsx`:
- New route: `<Route path="/admin/highlights" element={<Protected><AdminHighlights /></Protected></Route>` (grouped with the other `/admin/*` routes).
- New nav item: `{ to: '/admin/highlights', label: 'Highlights', icon: Sparkles, adminOnly: true }`, placed next to `'Manage Posts'`/`'Users'`.

## Testing

- Frontend: lint + build on all touched/new files.
- Manual: as admin, click the new "Highlights" nav item — confirm it lists past events (and not future ones), pick one, upload a photo, confirm it appears — then confirm that same photo also shows on `EventCheckin.jsx`'s Photos section for the same event (proving both entry points share the same data/component). Confirm a plain alumni account does not see the "Highlights" nav item.
