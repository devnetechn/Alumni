# Event Check-in Scanner — Design

## Problem

Officers/admins have no way to actually check an alumnus in at an event. The
backend already fully implements the rule (`POST /api/events/:id/checkin` in
`alumni-backend/src/routes/events.js`, `requireAuth` + `requireOfficer`):
resolves the scanned code via `resolveAlumniFromCode` (matches `ALUMNI:<id>`
or a raw `nfc_uid`), rejects with 403 unless the alumnus RSVP'd `going` and
is marked `paid`, then inserts/updates `event_checkins`. But no frontend UI
ever calls it — `EventCheckin.jsx` only lists existing check-ins and shows a
static `EVENT:{id}` QR code that no backend route reads (it's leftover/dead
display, unrelated to this feature, left untouched).

Alumni already carry a scannable identity: `AlumniId.jsx` renders a QR
encoding `me.nfc_uid || ALUMNI:${me.id}` — exactly the code format the
backend expects.

## Scope

Frontend-only. No backend changes — the existing endpoint's contract
(`{ code }` in, `{ checkin }` or an error status out) is sufficient.

## Design

**Where:** a new "Scan Alumni" panel added to `EventCheckin.jsx`, above the
existing attendance list. Reached the same way officers already reach this
page (event's Check-in button / `/scan` picker) — no new route.

**Camera scanning (primary):** uses the already-installed `html5-qrcode`
package's `Html5Qrcode` class in continuous-scan mode.

- On mount of the scan panel, start the scanner against a fixed-size
  `<div id="qr-reader">` region.
- On every successful decode (`qrCodeSuccessCallback`), pause reprocessing
  the same value: track `lastCode` + `lastCodeAt` and ignore a repeat of the
  same string within a short cooldown window (e.g. 3s) so a still-visible
  badge doesn't spam duplicate submissions — the *camera* keeps running
  throughout, only duplicate submissions are suppressed.
- POST `{ code }` to `POST /api/events/:id/checkin`.
- Show a result banner for ~2.5s: success shows the alumnus's name + "Checked
  in ✓" (from the response's `checkin` — need the joined name; simplest is to
  have the frontend look up the name from the fresh attendance list re-fetch,
  or just show a generic "Checked in ✓" since the endpoint itself doesn't
  return the alumnus's name — confirmed via reading `events.js`, `RETURNING
  *` only returns the `event_checkins` row, no joined `full_name`). Decision:
  banner shows "Checked in ✓" on success, or the exact API error message on
  failure (404 "Alumni not found for this code" / 403 "Alumni must RSVP
  going and be marked paid before check-in").
- After a successful check-in, re-fetch the attendance list
  (`loadAttendance()`, already defined in the page) so the table updates
  live.
- Scanning never auto-stops; the officer clicks a "Stop Scanning" button to
  release the camera, or navigates away (cleanup in a `useEffect` return).

**NFC tap (fallback):** a "Scan NFC Tag" button, shown only when
`'NDEFReader' in window` (mirrors `Profile.jsx`'s `scanNfc` exactly — same
feature-detection, same `alert()` on unsupported/failure). On a successful
read, POSTs `{ code: ev.serialNumber }` to the same endpoint and reuses the
same result-banner + re-fetch logic as the camera path. Camera and NFC are
independent, both available at once — the officer can use whichever the
alumnus presents (QR badge or physical NFC card).

**Errors:** any request failure (network, unexpected 4xx/5xx) surfaces
through the same banner with the server's `error` message when present, or a
generic fallback.

## Out of scope

- No changes to `resolveAlumniFromCode` or the check-in endpoint.
- No changes to the existing dead `EVENT:{id}` QR display block.
- No sound/vibration feedback — visual banner only.
- No offline queueing — each scan is a live network call.
