# Event Check-in Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an officer/admin actually check alumni into an event by scanning their QR badge (camera) or tapping an NFC card, calling the existing, already-correct `POST /api/events/:id/checkin` endpoint.

**Architecture:** A new self-contained `AlumniScanner` component owns all scan state (camera lifecycle via `html5-qrcode`, NFC via Web NFC, submit-and-result-banner logic). `EventCheckin.jsx` renders it above the existing attendance table and passes a callback to refresh that table after each successful check-in. No backend changes.

**Tech Stack:** React (Vite), `html5-qrcode` (already an installed dependency, currently unused), Web NFC (`window.NDEFReader`, no dependency — same browser API `Profile.jsx` already uses), existing `api` axios instance, existing `Panel`/`Button` UI primitives.

## Global Constraints

- Frontend-only change. Do not modify `alumni-backend/src/routes/events.js` or any backend file — the endpoint's contract is already correct and covered by existing backend tests.
- Follow the codebase's brutalist design tokens already used throughout `EventCheckin.jsx` (`var(--brand-ink)`, `var(--radius)`, `Panel`/`Button` from `../components/ui`) — no new visual system.
- This codebase has no frontend unit test framework (confirmed: verification for frontend work in this repo is `eslint` + `vite build` + manual/Playwright browser check, not Jest). Do not introduce one. Each task's verification step is eslint + build, plus a manual check where noted.
- Do not touch the existing `EVENT:{id}` QR display block in `EventCheckin.jsx` — it is unrelated, pre-existing, and out of scope per the design doc.
- Match `requireOfficer`'s exact rule when gating the scan UI client-side: `user.role === 'admin' || user.is_batch_leader` (see `alumni-backend/src/middleware/auth.js:40-45`).

---

### Task 1: `AlumniScanner` component — camera scanning, NFC fallback, submit logic

**Files:**
- Create: `alumni-frontend/src/components/AlumniScanner.jsx`

**Interfaces:**
- Consumes: `api` (default export `{ get, post }` axios wrapper) from `../api`; `Panel`, `Button` from `./ui`; `Html5Qrcode` from `html5-qrcode`.
- Produces: `export default function AlumniScanner({ eventId, onCheckedIn })` — a React component. `eventId` (string|number) is the event to check into. `onCheckedIn` (function, no args) is called once after each successful check-in POST, so the parent can refresh its own data. Renders its own `Panel` — parent places it in the page layout.

- [ ] **Step 1: Create the component file with camera scan + NFC + submit logic**

```jsx
// alumni-frontend/src/components/AlumniScanner.jsx
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, Nfc, Square } from 'lucide-react';
import { api } from '../api';
import { Panel, Button } from './ui';

const SCANNER_ELEMENT_ID = 'alumni-scanner-camera';
const DUPLICATE_COOLDOWN_MS = 3000;

export default function AlumniScanner({ eventId, onCheckedIn }) {
  const [scanning, setScanning] = useState(false);
  const [banner, setBanner] = useState(null); // { type: 'ok' | 'err', text: string }
  const html5QrCodeRef = useRef(null);
  const lastCodeRef = useRef({ code: null, at: 0 });
  const submittingRef = useRef(false);

  const submitCode = async (code) => {
    if (!code || submittingRef.current) return;
    const now = Date.now();
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < DUPLICATE_COOLDOWN_MS) {
      return;
    }
    lastCodeRef.current = { code, at: now };
    submittingRef.current = true;
    try {
      await api.post(`/events/${eventId}/checkin`, { code });
      setBanner({ type: 'ok', text: 'Checked in ✓' });
      onCheckedIn();
    } catch (err) {
      setBanner({ type: 'err', text: err.response?.data?.error || 'Check-in failed' });
    } finally {
      submittingRef.current = false;
      setTimeout(() => setBanner(null), 2500);
    }
  };

  useEffect(() => {
    if (!scanning) return undefined;

    const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID);
    html5QrCodeRef.current = html5QrCode;
    let cancelled = false;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => { submitCode(decodedText); },
        () => {} // per-frame decode misses; ignore
      )
      .catch((err) => {
        if (!cancelled) setBanner({ type: 'err', text: 'Camera failed to start: ' + err });
      });

    return () => {
      cancelled = true;
      html5QrCode
        .stop()
        .then(() => html5QrCode.clear())
        .catch(() => {});
      html5QrCodeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, eventId]);

  const scanNfc = async () => {
    if (!('NDEFReader' in window)) {
      alert('Web NFC only works on Chrome Android.');
      return;
    }
    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = (ev) => { submitCode(ev.serialNumber); };
    } catch (e) {
      alert('NFC scan failed: ' + e.message);
    }
  };

  return (
    <Panel className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--brand-ink)]">Scan Alumni</h2>
        {'NDEFReader' in window && (
          <Button type="button" variant="secondary" onClick={scanNfc}>
            <Nfc size={16} />
            Scan NFC Tag
          </Button>
        )}
      </div>

      {banner && (
        <div
          className={`mb-4 p-3 rounded-[var(--radius)] border-2 font-semibold text-sm ${
            banner.type === 'ok'
              ? 'bg-[var(--brand-success)]/10 border-[var(--brand-success)] text-[var(--brand-success)]'
              : 'bg-[var(--brand-danger)]/10 border-[var(--brand-danger)] text-[var(--brand-danger)]'
          }`}
        >
          {banner.text}
        </div>
      )}

      {scanning ? (
        <div>
          <div id={SCANNER_ELEMENT_ID} className="rounded-[var(--radius)] overflow-hidden border-[2.5px] border-[var(--brand-ink)]" />
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setScanning(false)}>
            <Square size={16} />
            Stop Scanning
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setScanning(true)}>
          <ScanLine size={16} />
          Start Camera Scan
        </Button>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: Lint the new file**

Run: `cd alumni-frontend && npx eslint src/components/AlumniScanner.jsx`
Expected: no new errors beyond the project's pre-existing baseline patterns (member-expression JSX / `motion` false positives don't apply here — this file uses none, so expect a clean pass).

- [ ] **Step 3: Commit**

```bash
git add alumni-frontend/src/components/AlumniScanner.jsx
git commit -m "feat(frontend): add AlumniScanner component for camera/NFC event check-in"
```

---

### Task 2: Wire `AlumniScanner` into `EventCheckin.jsx`, gated to officers

**Files:**
- Modify: `alumni-frontend/src/pages/EventCheckin.jsx`

**Interfaces:**
- Consumes: `AlumniScanner` from `../components/AlumniScanner` (Task 1) — props `eventId`, `onCheckedIn`. `useAuth` from `../auth` (existing hook, already used elsewhere in the app; returns `{ user, ... }` where `user.role` and `user.is_batch_leader` are available per `alumni-frontend/src/auth.jsx`).
- Produces: nothing new consumed by later tasks — this is the last task.

- [ ] **Step 1: Add the import and auth check**

In `alumni-frontend/src/pages/EventCheckin.jsx`, add to the import block at the top (after the existing `api, API_BASE` import):

```jsx
import { useAuth } from '../auth';
import AlumniScanner from '../components/AlumniScanner';
```

- [ ] **Step 2: Read `user` in the component and render the scanner panel**

Inside `export default function EventCheckin() {`, right after `const { id } = useParams();`, add:

```jsx
  const { user } = useAuth();
  const isOfficer = user?.role === 'admin' || user?.is_batch_leader;
```

Then, in the JSX, insert the scanner panel right before the existing `<Panel className="overflow-hidden">` (the attendance list panel), so it appears between the QR-display panel and the attendance table:

```jsx
      {isOfficer && <AlumniScanner eventId={id} onCheckedIn={loadAttendance} />}

      <Panel className="overflow-hidden">
```

- [ ] **Step 3: Lint and build**

Run: `cd alumni-frontend && npx eslint src/pages/EventCheckin.jsx`
Expected: no new errors beyond the pre-existing baseline (~19-20 problems repo-wide, unrelated to this file).

Run: `cd alumni-frontend && npm run build`
Expected: build succeeds with no new errors (pre-existing chunk-size warnings are expected and unrelated).

- [ ] **Step 4: Manual verification**

Start both dev servers (`alumni-backend`: `npm run dev`; `alumni-frontend`: `npm run dev`). Log in as an admin/officer user, navigate to an event's check-in page (`/events/:id/checkin`). Confirm:
- The "Scan Alumni" panel renders with a "Start Camera Scan" button (and a "Scan NFC Tag" button only if the browser exposes `NDEFReader`, i.e. not in most desktop browsers — absence there is expected, not a bug).
- Clicking "Start Camera Scan" prompts for camera permission and shows a live camera feed in the panel.
- Clicking "Stop Scanning" releases the camera and returns to the "Start Camera Scan" button.
- Log in as a non-officer alumni account and confirm the "Scan Alumni" panel does not render at all.

- [ ] **Step 5: Commit**

```bash
git add alumni-frontend/src/pages/EventCheckin.jsx
git commit -m "feat(frontend): wire AlumniScanner into the event check-in page"
```
