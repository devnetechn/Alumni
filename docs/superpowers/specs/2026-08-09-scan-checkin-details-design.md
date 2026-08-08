# Scan check-in: show alumni details on scan

## Problem

The event check-in scanner (`AlumniScanner.jsx`, used from `EventCheckin.jsx`) lets admins/officers scan an alumni's QR code (or NFC tag) to check them into an event. On a successful scan it only shows a generic "Checked in ✓" banner — the staff member scanning has no way to visually confirm *who* was just checked in.

## Goal

When an officer scans a QR/NFC code and the check-in succeeds, display that alumni's photo, full name, batch year, and course on screen, so staff can visually confirm the right person was checked in.

## Non-goals

- Changing who is allowed to scan (already gated by `requireOfficer` on the backend and `isOfficer` on the frontend — admins and batch leaders only, unchanged).
- A scan history / list of recent check-ins on this screen (the existing "Attendance List" table on `EventCheckin.jsx` already serves that purpose).
- Showing company/position or contact info — out of scope per this round.

## Design

### Backend: `alumni-backend/src/routes/events.js`

`POST /:id/checkin` already calls `resolveAlumniFromCode(req.db, req.body.code)`, which does `SELECT * FROM users ...` to find the alumni before inserting the check-in row. That full row (including `password_hash`) is never sent to the client today — the response is just `{ checkin: rows[0] }`.

Change the response to also include a trimmed, explicitly-picked alumni object:

```js
res.status(201).json({
  checkin: rows[0],
  alumni: {
    id: alumni.id,
    full_name: alumni.full_name,
    profile_pic: alumni.profile_pic,
    batch_year: alumni.batch_year,
    course: alumni.course,
  },
});
```

No new query — this reuses the `alumni` row already fetched for check-in processing. Explicit field picks (not spreading the row) so nothing sensitive (`password_hash`, `email`, etc.) leaks into the response now or if columns are added later.

### Frontend: `alumni-frontend/src/components/AlumniScanner.jsx`

Add a `scannedAlumni` state, `null` initially.

- On a successful `submitCode` call, set `scannedAlumni` from `response.data.alumni` (in addition to the existing "Checked in ✓" banner, which still auto-clears after 2.5s as today).
- Render a details card above the camera view whenever `scannedAlumni` is set: profile picture (or first-initial avatar, matching the existing pattern in `AlumniId.jsx`) plus full name, batch year, and course.
- The card is **replaced only by the next successful scan** — it does not auto-dismiss, and it is untouched by scan errors (wrong RSVP status, alumni not found, camera errors, etc.). Those continue to surface only through the existing transient error banner.
- No changes to the duplicate-scan cooldown, NFC scan path (it calls the same `submitCode`, so it gets the card for free), or the error-handling branch of `submitCode`.

### Data flow

```
Officer scans QR/NFC
  -> submitCode(code)
  -> POST /events/:id/checkin { code }
  -> resolveAlumniFromCode (existing) finds alumni row
  -> INSERT/UPDATE event_checkins (existing)
  -> response: { checkin, alumni: {id, full_name, profile_pic, batch_year, course} }
  -> frontend: setScannedAlumni(alumni) + existing "Checked in ✓" banner
  -> details card renders/replaces previous card
```

On error (4xx from the endpoint): existing `catch` branch sets the error banner as today; `scannedAlumni` is left untouched.

## Testing

- Backend: extend `alumni-backend/tests/events.test.js` (or wherever check-in is currently tested) to assert a successful check-in response includes the trimmed `alumni` object with the expected fields, and does **not** include `password_hash` or `email`.
- Frontend: no component-test infra exists in this repo for pages/components; verify manually — successful scan shows the card with correct details, a subsequent error (e.g. re-scanning an alumni who hasn't RSVP'd) leaves the card in place, and a second successful scan (different alumni) replaces the card contents.
