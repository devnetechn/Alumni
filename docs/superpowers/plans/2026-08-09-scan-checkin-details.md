# Scan Check-in Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an officer/admin scans an alumni's QR/NFC code at event check-in, show that alumni's photo, name, batch year, and course on screen instead of just a generic "Checked in ✓" banner.

**Architecture:** The check-in endpoint already looks up the full alumni row to process the check-in; it will now also return a small, explicitly-picked subset of that row's fields. The frontend scanner component stores the most recently scanned alumni in state and renders a details card, which persists until the next successful scan replaces it (errors don't touch it).

**Tech Stack:** Express + `pg` (backend), React (frontend), Jest + Supertest (backend tests). No new dependencies.

## Global Constraints

- Never return `password_hash` or other sensitive user fields from the check-in endpoint — only explicitly pick `id, full_name, profile_pic, batch_year, course`.
- No new database queries — reuse the `alumni` row already fetched by `resolveAlumniFromCode`.
- Reuse the existing `Avatar` component (`alumni-frontend/src/components/ui/Avatar.jsx`) for the photo/initial display — don't reimplement avatar logic.
- The details card is not auto-dismissed and is not cleared by scan errors — only a new successful scan replaces it.

---

### Task 1: Backend — return alumni details from the check-in endpoint

**Files:**
- Modify: `alumni-backend/src/routes/events.js:145`
- Test: `alumni-backend/tests/event-registrations.test.js`

**Interfaces:**
- Produces: `POST /api/events/:id/checkin` success response shape `{ checkin: {...}, alumni: { id, full_name, profile_pic, batch_year, course } }` (previously `{ checkin: {...} }` only). Consumed by Task 2's frontend change.

- [ ] **Step 1: Write the failing test**

Add to `alumni-backend/tests/event-registrations.test.js` (after the existing `'POST /checkin succeeds for a paid+going alumni...'` test, which already builds a `makeEventWithRsvp` fixture you can reuse as a pattern):

```js
test('POST /checkin response includes trimmed alumni details, not sensitive fields', async () => {
  const { alumni, eventId } = await makeEventWithRsvp({ paid: true });
  const officer = await insertUser({ is_batch_leader: true });

  const res = await request(app)
    .post(`/api/events/${eventId}/checkin`)
    .set('Authorization', authHeader(officer))
    .send({ code: `ALUMNI:${alumni.id}` });

  expect(res.status).toBe(201);
  expect(res.body.alumni).toEqual({
    id: alumni.id,
    full_name: 'Attendee One',
    profile_pic: null,
    batch_year: 2020,
    course: 'BSCS',
  });
  expect(res.body.alumni.password_hash).toBeUndefined();
  expect(res.body.alumni.email).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/event-registrations.test.js -t "trimmed alumni details" --runInBand`
Expected: FAIL — `res.body.alumni` is `undefined` (the endpoint doesn't return `alumni` yet).

- [ ] **Step 3: Implement the response change**

In `alumni-backend/src/routes/events.js`, replace the final line of the `POST /:id/checkin` handler (currently `res.status(201).json({ checkin: rows[0] });` at line 145):

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

- [ ] **Step 4: Run the test to verify it passes**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/event-registrations.test.js --runInBand`
Expected: all tests in the file PASS, including the new one.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/events.js alumni-backend/tests/event-registrations.test.js
git commit -m "feat(backend): return trimmed alumni details from event check-in"
```

---

### Task 2: Frontend — show a persistent alumni details card on successful scan

**Files:**
- Modify: `alumni-frontend/src/components/AlumniScanner.jsx`

**Interfaces:**
- Consumes: `POST /api/events/:id/checkin` response shape from Task 1: `{ checkin, alumni: { id, full_name, profile_pic, batch_year, course } }`.
- Consumes: `Avatar` component from `alumni-frontend/src/components/ui/Avatar.jsx`, props `{ name, pic, size }` — renders a photo or initial in a bordered square.
- Consumes: `Panel`, `Button` from `alumni-frontend/src/components/ui` (already imported in this file).

- [ ] **Step 1: Add `scannedAlumni` state and capture it on success**

In `alumni-frontend/src/components/AlumniScanner.jsx`, add the import and state alongside the existing ones (near the top of the component, with `banner`):

```jsx
import { Panel, Button, Avatar } from './ui';
```

```jsx
  const [scannedAlumni, setScannedAlumni] = useState(null);
```

In `submitCode`, the success branch currently reads:

```jsx
      await api.post(`/events/${eventId}/checkin`, { code });
      setBanner({ type: 'ok', text: 'Checked in ✓' });
      onCheckedIn();
```

Change it to capture the returned alumni details:

```jsx
      const { data } = await api.post(`/events/${eventId}/checkin`, { code });
      setScannedAlumni(data.alumni);
      setBanner({ type: 'ok', text: 'Checked in ✓' });
      onCheckedIn();
```

Do not change the `catch` branch — errors continue to only set `banner`, leaving `scannedAlumni` as-is.

- [ ] **Step 2: Render the details card**

In the JSX, immediately after the `{banner && (...)}` block and before the `{scanning ? (...) : (...)}` block, add:

```jsx
      {scannedAlumni && (
        <Panel className="p-4 mb-4 flex items-center gap-4">
          <Avatar name={scannedAlumni.full_name} pic={scannedAlumni.profile_pic} size="lg" />
          <div>
            <p className="font-bold text-[var(--brand-ink)]">{scannedAlumni.full_name}</p>
            <p className="text-sm text-slate-500">
              Batch {scannedAlumni.batch_year || '—'} · {scannedAlumni.course || '—'}
            </p>
          </div>
        </Panel>
      )}
```

- [ ] **Step 3: Lint**

Run (PowerShell): `Set-Location alumni-frontend; npx eslint src/components/AlumniScanner.jsx`
Expected: no new errors.

- [ ] **Step 4: Build**

Run (PowerShell): `Set-Location alumni-frontend; npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

Start both dev servers (`npm run dev` in `alumni-backend`, `npm run dev` in `alumni-frontend`). As an admin, open an event's check-in page, scan (or manually POST, if no physical QR is handy) a valid paid+going alumni's code — confirm the details card appears with photo/initial, name, batch, and course. Trigger an error (e.g. scan a code for an alumni who hasn't RSVP'd) and confirm the card stays visible while the error banner shows separately. Scan a second valid alumni and confirm the card's contents are replaced.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/components/AlumniScanner.jsx
git commit -m "feat(frontend): show scanned alumni's details on event check-in"
```
