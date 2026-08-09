# Required Registration Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A profile photo is required to complete registration (both `alumnus` and `guest` signups) — the form can't be submitted without one, and the resulting account has the photo attached from the moment it's created, no separate upload step needed.

**Architecture:** `profile_pic` is added to the existing signup metadata passthrough (`POST /signup-checkout` → PayMongo checkout metadata → webhook reads it back → `INSERT INTO users`), the same path `email`, `full_name`, `address`, etc. already take. This was verified safe directly against PayMongo's live API: an 80,000-character metadata value round-trips with no truncation, far more than a resized photo needs. No new table, no separate upload endpoint.

**Tech Stack:** Express + `pg` (backend), React (frontend), Jest + Supertest (backend tests). No new dependencies — the frontend reuses `Profile.jsx`'s existing canvas-resize/compress logic verbatim.

## Global Constraints

- `profile_pic` is required for both `member_type: 'alumnus'` and `member_type: 'guest'` signups — no branching by type.
- The renewal flow (`POST /registration/renew-checkout`, `RenewRegistration.jsx`) is not touched — out of scope.
- The photo resize/compress behavior (max source 2MB, resize to 400px longest side, JPEG quality 0.85) must exactly match `Profile.jsx`'s existing `onFile` handler — don't reimplement it differently.

---

### Task 1: Backend — require `profile_pic` on `POST /signup-checkout`

**Files:**
- Modify: `alumni-backend/src/routes/registration.js:11-64`
- Test: `alumni-backend/tests/registration.test.js`

**Interfaces:**
- Produces: `POST /api/registration/signup-checkout` now returns 400 `{ error: 'A profile photo is required' }` when `profile_pic` is missing from the request body. On success, the PayMongo checkout session's `metadata.profile_pic` is set from `req.body.profile_pic`. Consumed by Task 2 (webhook reads `metadata.profile_pic`).

- [ ] **Step 1: Write the failing tests**

In `alumni-backend/tests/registration.test.js`, add a new test right after the existing `'POST /api/registration/signup-checkout rejects when no fee is configured'` test:

```js
test('POST /api/registration/signup-checkout rejects when profile_pic is missing', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person' });

  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/photo/i);
});
```

Then update the three existing tests that hit `/signup-checkout` without `profile_pic` so they keep testing what they say they test (otherwise they'd all fail on the new required-photo check before reaching their actual assertion):

Change `'POST /api/registration/signup-checkout creates a checkout session and returns its URL'` — add `profile_pic` to the `.send(...)` call and assert it reaches metadata:

```js
test('POST /api/registration/signup-checkout creates a checkout session and returns its URL', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_test123', checkoutUrl: 'https://checkout.paymongo.com/cs_test123' });

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person', member_type: 'guest', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(200);
  expect(res.body.checkoutUrl).toBe('https://checkout.paymongo.com/cs_test123');
  expect(paymongo.createCheckoutSession).toHaveBeenCalledTimes(1);
  const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
  expect(callArgs.lineItems[0].amount).toBe(20000);
  expect(callArgs.metadata.kind).toBe('signup');
  expect(callArgs.metadata.session_token).toBeTruthy();
  expect(callArgs.successUrl).toContain(`session_id=${callArgs.metadata.session_token}`);
  expect(callArgs.metadata.email).toBe('new@test.com');
  expect(callArgs.metadata.member_type).toBe('guest');
  expect(callArgs.metadata.password_hash).toBeTruthy();
  expect(callArgs.metadata.password_hash).not.toBe('secret123');
  expect(callArgs.metadata.profile_pic).toBe('data:image/jpeg;base64,AAAA');
});
```

Change `'POST /api/registration/signup-checkout rejects a duplicate email'` — add `profile_pic` so it keeps testing the duplicate-email path (409), not the photo check (400):

```js
test('POST /api/registration/signup-checkout rejects a duplicate email', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  await insertUser({ email: 'dupe@test.com' });

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'dupe@test.com', password: 'secret123', full_name: 'Dupe', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(409);
});
```

Change `'POST /api/registration/signup-checkout rejects when registration is closed'` and `'... rejects when no fee is configured'` the same way — add `profile_pic: 'data:image/jpeg;base64,AAAA'` to each `.send(...)` call, so each keeps testing the condition named in its title rather than incidentally passing because the photo check fires first:

```js
test('POST /api/registration/signup-checkout rejects when registration is closed', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_open = false WHERE id = $1', [school.id]);

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(400);
});

test('POST /api/registration/signup-checkout rejects when no fee is configured', async () => {
  const school = await getDefaultSchool();

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/registration.test.js -t "profile_pic is missing" --runInBand`
Expected: FAIL — currently `profile_pic` isn't checked at all, so the request succeeds (200) instead of returning 400.

- [ ] **Step 3: Implement the change**

In `alumni-backend/src/routes/registration.js`, change:

```js
router.post('/signup-checkout', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, contact, address, member_type } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
```

to:

```js
router.post('/signup-checkout', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, contact, address, member_type, profile_pic } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (!profile_pic) return res.status(400).json({ error: 'A profile photo is required' });
```

Then add `profile_pic` to the `metadata` object passed to `paymongo.createCheckoutSession(...)` — find:

```js
    metadata: {
      kind: 'signup',
      school_id: String(req.school.id),
      session_token: sessionToken,
      email,
      password_hash,
      full_name: full_name || '',
      batch_year: batch_year ? String(batch_year) : '',
      contact: contact || '',
      address: address || '',
      member_type: resolvedMemberType,
    },
```

and add `profile_pic,` as a new line in that object (right after `email,` is fine).

- [ ] **Step 4: Run the tests to verify they pass**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/registration.test.js --runInBand`
Expected: all tests in the file PASS.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/registration.js alumni-backend/tests/registration.test.js
git commit -m "feat(backend): require profile_pic to complete registration"
```

---

### Task 2: Backend — webhook creates the user with the photo attached

**Files:**
- Modify: `alumni-backend/src/routes/paymentsWebhook.js`
- Test: `alumni-backend/tests/paymentsWebhook.test.js`

**Interfaces:**
- Consumes: `metadata.profile_pic` (Task 1's addition to the checkout session metadata).
- Produces: no interface change — the `users` row created by a signup webhook event now has `profile_pic` populated instead of always `NULL`.

- [ ] **Step 1: Write the failing test**

In `alumni-backend/tests/paymentsWebhook.test.js`, update the existing `'creates a new user from a signup webhook event'` test to include `profile_pic` in the event metadata and assert it lands on the created row:

```js
test('creates a new user from a signup webhook event', async () => {
  const school = await getDefaultSchool();
  const password_hash = await hashPassword('secret123');
  const payload = checkoutPaidEvent('evt_signup1', 'cs_signup1', {
    kind: 'signup',
    school_id: String(school.id),
    session_token: 'token-signup1',
    email: 'webhookuser@test.com',
    password_hash,
    full_name: 'Webhook User',
    batch_year: '2020',
    contact: '',
    address: '',
    member_type: 'alumnus',
    profile_pic: 'data:image/jpeg;base64,AAAA',
  });
  const { rawBody, header } = signedRequest(payload);

  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('Paymongo-Signature', header)
    .send(rawBody);

  expect(res.status).toBe(200);

  const rows = await query('SELECT * FROM users WHERE email = $1', ['webhookuser@test.com']);
  expect(rows.length).toBe(1);
  expect(rows[0].paymongo_checkout_session_id).toBe('token-signup1');
  expect(new Date(rows[0].registration_paid_until) > new Date()).toBe(true);
  expect(rows[0].profile_pic).toBe('data:image/jpeg;base64,AAAA');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/paymentsWebhook.test.js -t "creates a new user from a signup" --runInBand`
Expected: FAIL — `rows[0].profile_pic` is `undefined`/`null`, not the expected data URL.

- [ ] **Step 3: Implement the change**

In `alumni-backend/src/routes/paymentsWebhook.js`, change the signup branch's INSERT from:

```js
  if (metadata.kind === 'signup') {
    await queryForSchool(
      schoolId,
      `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, contact, address, member_type, registration_paid_until, paymongo_checkout_session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() + interval '2 years', $9)`,
      [
        schoolId,
        metadata.email,
        metadata.password_hash,
        metadata.full_name || null,
        metadata.batch_year ? Number(metadata.batch_year) : null,
        metadata.contact || null,
        metadata.address || null,
        metadata.member_type,
        metadata.session_token,
      ]
    );
  }
```

to:

```js
  if (metadata.kind === 'signup') {
    await queryForSchool(
      schoolId,
      `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, contact, address, member_type, profile_pic, registration_paid_until, paymongo_checkout_session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + interval '2 years', $10)`,
      [
        schoolId,
        metadata.email,
        metadata.password_hash,
        metadata.full_name || null,
        metadata.batch_year ? Number(metadata.batch_year) : null,
        metadata.contact || null,
        metadata.address || null,
        metadata.member_type,
        metadata.profile_pic || null,
        metadata.session_token,
      ]
    );
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest tests/paymentsWebhook.test.js --runInBand`
Expected: all tests in the file PASS.

- [ ] **Step 5: Run the full backend suite**

Run (PowerShell): `Set-Location alumni-backend; $env:NODE_ENV='test'; npx jest --runInBand`
Expected: all suites PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/paymentsWebhook.js alumni-backend/tests/paymentsWebhook.test.js
git commit -m "feat(backend): attach profile_pic when creating a user from the signup webhook"
```

---

### Task 3: Frontend — required photo upload on the registration form

**Files:**
- Modify: `alumni-frontend/src/pages/Register.jsx`

**Interfaces:**
- Consumes: none new — `form.profile_pic` is a plain string (data URL) added to the existing `form` state object already posted to `POST /registration/signup-checkout` (Task 1 now requires it).

- [ ] **Step 1: Add the resize/compress handler and photo state**

In `alumni-frontend/src/pages/Register.jsx`, add imports for the upload UI and a ref for the hidden file input, matching `Profile.jsx`'s existing pattern:

```jsx
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';
```

Add a `fileRef` next to the existing `form`/`err`/`loading` state, and copy `Profile.jsx`'s `onFile` handler verbatim (only the setter target changes, from `setForm((f) => ...)` on the profile form to this page's `setForm`):

```jsx
  const fileRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr('Image too large (max 2MB)');
      return;
    }
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

  const clearPhoto = () => setForm((f) => ({ ...f, profile_pic: '' }));
```

(This reuses `err`/`setErr`, which already exist in this component, instead of `Profile.jsx`'s separate `msg` state — this page only needs a single error slot.)

- [ ] **Step 2: Block submit when no photo is selected**

In `onSubmit`, add the check right after `setLoading(true)` and before the `try`:

```jsx
  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.profile_pic) {
      setErr('Please upload a profile photo');
      return;
    }
    setLoading(true);
    try {
```

- [ ] **Step 3: Add the photo field to the form JSX**

Insert a new field at the top of the existing `<Section title="Account">` block (before the "Full Name" `Field`), so the photo is the first thing filled in:

```jsx
            <Section title="Account">
              <Field label="Profile Photo" span>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-[var(--radius)] bg-[var(--brand-surface)] border-2 border-[var(--brand-ink)] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {form.profile_pic ? (
                      <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">No photo</span>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
                  <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                    <Upload size={16} /> Upload Photo
                  </Button>
                  {form.profile_pic && (
                    <Button type="button" variant="secondary" onClick={clearPhoto}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="Full Name" span>
```

(The closing `</Field>` that used to belong to "Full Name" is untouched — only a new `Field` is inserted before it.)

- [ ] **Step 4: Lint**

Run (PowerShell): `Set-Location alumni-frontend; npx eslint src/pages/Register.jsx`
Expected: no new errors.

- [ ] **Step 5: Build**

Run (PowerShell): `Set-Location alumni-frontend; npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification**

Start both dev servers. Go to `/register`, fill in the form but skip the photo — confirm submitting shows "Please upload a profile photo" and does not redirect to PayMongo. Upload a photo, submit — confirm it redirects to a real PayMongo checkout URL. Complete the payment (test mode) and confirm the resulting account (visible in the admin Users table) shows the uploaded photo instead of an initial.

- [ ] **Step 7: Commit**

```bash
git add alumni-frontend/src/pages/Register.jsx
git commit -m "feat(frontend): require a profile photo on the registration form"
```
