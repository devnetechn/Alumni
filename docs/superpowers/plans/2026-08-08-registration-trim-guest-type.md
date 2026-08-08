# Registration Form Trim + Guest/Alumnus Member Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim the registration form to Full Name, Email, Password, Batch Year, Contact, Address; add a Guest/Alumnus member-type selection at signup; guests can never be promoted to batch leader.

**Architecture:** New `users.member_type` column (`'alumnus'`|`'guest'`, default `'alumnus'`), separate from the existing `role` column (which governs admin/officer permissions and must not be touched). `POST /api/auth/register` accepts and stores `address` (previously silently dropped) and `member_type`. `PUT /api/admin/users/:id` rejects promoting a guest to batch leader. Two frontend pages updated: `Register.jsx` (trimmed fields + dropdown) and `AdminUsers.jsx` (badge + disabled toggle for guests).

**Tech Stack:** Node/Express + `pg` (raw SQL, no ORM), Jest + Supertest for backend tests, React (Vite), existing `Panel`/`Button`/`Input`/`Badge` UI primitives.

## Global Constraints

- Do not modify the `role` column, its CHECK constraint, or any of `requireAdmin`/`requireOfficer`/the admin/alumni promote-demote toggle — `member_type` is fully orthogonal to `role`.
- Schema changes go in `alumni-backend/db/schema.sql` using the codebase's existing idempotent pattern: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` appended near the end of the file (see `logo`/`trial_ends_at` on the `schools` table for precedent).
- After changing `schema.sql`, both the dev and test databases must be migrated: `npm run migrate` and `npm run migrate:test` (from `alumni-backend/`).
- Guests keep full access to paid events — confirmed explicitly by the user. Do not add any RSVP/payment restriction for guests anywhere.
- No frontend test framework exists in this repo. Frontend verification is `eslint` + `vite build` + manual/Playwright browser check, not Jest.

---

### Task 1: `member_type` column + `POST /api/auth/register`

**Files:**
- Modify: `alumni-backend/db/schema.sql`
- Modify: `alumni-backend/src/routes/auth.js`
- Test: `alumni-backend/tests/auth.test.js`

**Interfaces:**
- Consumes: `req.db`, `req.school` (existing tenant-scoped query function and resolved school, already used by this route).
- Produces: `POST /api/auth/register` now accepts `address` (string, optional) and `member_type` (`'alumnus'`|`'guest'`, optional, defaults to `'alumnus'`) in the request body, in addition to the existing accepted fields. Returns 400 if `member_type` is present and not one of the two allowed values. The returned `user` object (and everything downstream that reads `SELECT *` off `users`, e.g. `req.user`, `GET /me`) now includes `member_type`.

- [ ] **Step 1: Add the column to schema.sql**

At the end of `alumni-backend/db/schema.sql` (after the existing `ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_ends_at ...` line), add:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'alumnus'
  CHECK (member_type IN ('alumnus', 'guest'));
```

- [ ] **Step 2: Migrate dev and test databases**

Run (from `alumni-backend/`):
```bash
npm run migrate
npm run migrate:test
```
Expected: both print "Migration complete." with no errors.

- [ ] **Step 3: Write the failing tests**

Add to `alumni-backend/tests/auth.test.js` (after the existing `POST /api/auth/register creates an alumni user...` test):

```js
test('POST /api/auth/register defaults member_type to alumnus when omitted', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({ email: 'defaulttype@test.com', password: 'secret123', full_name: 'Default Type' });
  expect(res.status).toBe(201);
  expect(res.body.user.member_type).toBe('alumnus');
});

test('POST /api/auth/register accepts member_type guest and stores address', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({
      email: 'guest@test.com',
      password: 'secret123',
      full_name: 'A Guest',
      member_type: 'guest',
      address: '123 Main St',
    });
  expect(res.status).toBe(201);
  expect(res.body.user.member_type).toBe('guest');
  expect(res.body.user.address).toBe('123 Main St');
});

test('POST /api/auth/register rejects an invalid member_type', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/auth/register')
    .set('Host', hostFor(school))
    .send({ email: 'badtype@test.com', password: 'secret123', member_type: 'faculty' });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/auth.test.js --runInBand`
Expected: the three new tests FAIL (member_type is undefined / address not stored / invalid value not rejected — current route ignores both fields entirely).

- [ ] **Step 5: Update the register route**

In `alumni-backend/src/routes/auth.js`, replace the `router.post('/register', ...)` handler with:

```js
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, course, contact, address, company, position, industry, member_type } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const resolvedMemberType = member_type || 'alumnus';
  if (!['alumnus', 'guest'].includes(resolvedMemberType)) {
    return res.status(400).json({ error: 'member_type must be alumnus or guest' });
  }

  const existing = await req.db('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await hashPassword(password);
  const rows = await req.db(
    `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, course, contact, address, company, position, industry, member_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [req.school.id, email, password_hash, full_name || null, batch_year || null, course || null, contact || null, address || null, company || null, position || null, industry || null, resolvedMemberType]
  );
  const user = rows[0];
  delete user.password_hash;
  res.status(201).json({ token: signToken(user), user });
}));
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/auth.test.js --runInBand`
Expected: all tests in this file PASS, including the 3 new ones.

- [ ] **Step 7: Commit**

```bash
git add alumni-backend/db/schema.sql alumni-backend/src/routes/auth.js alumni-backend/tests/auth.test.js
git commit -m "feat(backend): add member_type to registration, accept address"
```

---

### Task 2: Guests can't be promoted to batch leader

**Files:**
- Modify: `alumni-backend/src/routes/admin.js`
- Test: `alumni-backend/tests/admin.test.js`

**Interfaces:**
- Consumes: `req.db` (tenant-scoped query function, already used by this file); `member_type` column added in Task 1.
- Produces: `GET /api/admin/users` now includes `member_type` in each returned user row. `PUT /api/admin/users/:id` returns 400 (`{ error: 'Guests cannot be batch leaders' }`) when the request body sets `is_batch_leader: true` for a user whose `member_type` is `'guest'`.

- [ ] **Step 1: Write the failing tests**

Add to `alumni-backend/tests/admin.test.js` (after the existing `admin can list users, toggle role/active/is_batch_leader...` test):

```js
test('admin cannot make a guest a batch leader', async () => {
  const admin = await insertUser({ role: 'admin' });
  const guest = await insertUser({ member_type: 'guest' });

  const res = await request(app)
    .put(`/api/admin/users/${guest.id}`)
    .set('Authorization', authHeader(admin))
    .send({ is_batch_leader: true });

  expect(res.status).toBe(400);
});

test('admin can make an alumnus a batch leader', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumnus = await insertUser({ member_type: 'alumnus' });

  const res = await request(app)
    .put(`/api/admin/users/${alumnus.id}`)
    .set('Authorization', authHeader(admin))
    .send({ is_batch_leader: true });

  expect(res.status).toBe(200);
  expect(res.body.user.is_batch_leader).toBe(true);
});

test('GET /api/admin/users includes member_type', async () => {
  const admin = await insertUser({ role: 'admin' });
  const guest = await insertUser({ member_type: 'guest' });

  const res = await request(app).get('/api/admin/users').set('Authorization', authHeader(admin));
  expect(res.status).toBe(200);
  const found = res.body.users.find((u) => u.id === guest.id);
  expect(found.member_type).toBe('guest');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/admin.test.js --runInBand`
Expected: `admin cannot make a guest a batch leader` FAILS (currently returns 200, no restriction exists), `GET /api/admin/users includes member_type` FAILS (`member_type` is `undefined` — not in the SELECT list). The "can make an alumnus a batch leader" test passes already (no behavior change needed for that case), which is fine — it exists to pin down the non-restricted path.

- [ ] **Step 3: Update `admin.js`**

In `alumni-backend/src/routes/admin.js`, update the `GET /users` query and the `PUT /users/:id` handler:

```js
router.get('/users', asyncHandler(async (req, res) => {
  const users = await req.db(
    `SELECT id, email, role, active, is_batch_leader, member_type, full_name, batch_year, course, created_at
     FROM users ORDER BY created_at DESC`
  );
  res.json({ users });
}));

router.put('/users/:id', asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ['role', 'active', 'is_batch_leader']) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  if (updates.is_batch_leader === true) {
    const targetRows = await req.db('SELECT member_type FROM users WHERE id = $1', [req.params.id]);
    if (targetRows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (targetRows[0].member_type === 'guest') {
      return res.status(400).json({ error: 'Guests cannot be batch leaders' });
    }
  }

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  const rows = await req.db(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const user = rows[0];
  delete user.password_hash;
  res.json({ user });
}));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js tests/admin.test.js --runInBand`
Expected: all tests in this file PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd alumni-backend && NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand`
Expected: all suites pass (baseline was 29 suites / 134 tests before this plan; expect 31 tests added across Task 1 and Task 2, so 29 suites / 140 tests).

- [ ] **Step 6: Commit**

```bash
git add alumni-backend/src/routes/admin.js alumni-backend/tests/admin.test.js
git commit -m "feat(backend): block promoting guests to batch leader, expose member_type"
```

---

### Task 3: Trim the registration form and add the Guest/Alumnus dropdown

**Files:**
- Modify: `alumni-frontend/src/pages/Register.jsx`

**Interfaces:**
- Consumes: `register` from `useAuth()` (existing, unchanged signature — takes a plain object and POSTs it as-is to `/auth/register`, confirmed in `alumni-frontend/src/auth.jsx:51-52`); `Input` from `../components/ui`, which already supports a polymorphic `as` prop (e.g. `as="select"`) via `alumni-frontend/src/components/ui/Input.jsx`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the form state and JSX**

In `alumni-frontend/src/pages/Register.jsx`, replace the `useState` call:

```jsx
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', batch_year: '', contact: '', address: '', member_type: 'alumnus'
  });
```

Replace the three `<Section>` blocks (`Account`, `Academic`, `Professional`) with:

```jsx
            <Section title="Account">
              <Field label="Full Name" span>
                <Input value={form.full_name} onChange={update('full_name')} required />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={update('email')} required />
              </Field>
              <Field label="Password">
                <Input type="password" value={form.password} onChange={update('password')} required />
              </Field>
              <Field label="I am a">
                <Input as="select" value={form.member_type} onChange={update('member_type')}>
                  <option value="alumnus">Alumnus</option>
                  <option value="guest">Guest</option>
                </Input>
              </Field>
            </Section>

            <Section title="Details">
              <Field label="Batch Year">
                <Input value={form.batch_year} onChange={update('batch_year')} placeholder="2020" />
              </Field>
              <Field label="Contact">
                <Input value={form.contact} onChange={update('contact')} />
              </Field>
              <Field label="Address" span>
                <Input value={form.address} onChange={update('address')} />
              </Field>
            </Section>
```

Leave `onSubmit`, `Section`, and `Field` unchanged — `onSubmit` already spreads `form` as-is (plus parsing `batch_year`), so `member_type` and `address` are sent automatically.

- [ ] **Step 2: Lint**

Run: `cd alumni-frontend && npx eslint src/pages/Register.jsx` (use PowerShell if the Bash tool's `npx` fails to resolve `node` — a known environment quirk; PowerShell works)
Expected: no new errors beyond the project's pre-existing baseline.

- [ ] **Step 3: Build**

Run: `cd alumni-frontend && npm run build` (PowerShell if Bash fails)
Expected: build succeeds, same pre-existing chunk-size warning as before.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/pages/Register.jsx
git commit -m "feat(frontend): trim registration form, add guest/alumnus selection"
```

---

### Task 4: Show member type and disable batch-leader toggle for guests in AdminUsers

**Files:**
- Modify: `alumni-frontend/src/pages/AdminUsers.jsx`

**Interfaces:**
- Consumes: `member_type` field on each user row from `GET /api/admin/users` (added in Task 2); `Badge` from `../components/ui` (already imported in this file, tones documented in `alumni-frontend/src/components/ui/Badge.jsx`: `neutral`, `accent`, `success`, `danger`, `warning`).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Add the member-type badge next to the role badge**

In `alumni-frontend/src/pages/AdminUsers.jsx`, replace:

```jsx
                <td className="py-3 px-6">
                  {u.role === 'admin' ? (
                    <Badge tone="accent"><Crown size={12} /> Admin</Badge>
                  ) : (
                    <Badge tone="neutral">Alumni</Badge>
                  )}
                </td>
```

with:

```jsx
                <td className="py-3 px-6">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {u.role === 'admin' ? (
                      <Badge tone="accent"><Crown size={12} /> Admin</Badge>
                    ) : (
                      <Badge tone="neutral">Alumni</Badge>
                    )}
                    <Badge tone={u.member_type === 'guest' ? 'warning' : 'neutral'}>
                      {u.member_type === 'guest' ? 'Guest' : 'Alumnus'}
                    </Badge>
                  </div>
                </td>
```

- [ ] **Step 2: Disable the batch-leader toggle button for guests**

Replace:

```jsx
                    <button onClick={() => toggleLeader(u)} title="Toggle batch leader" className={`p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] ${u.is_batch_leader ? 'text-[#b8860b]' : 'text-[var(--brand-ink)]'}`}>
                      <Star size={16} />
                    </button>
```

with:

```jsx
                    <button
                      onClick={() => toggleLeader(u)}
                      disabled={u.member_type === 'guest'}
                      title={u.member_type === 'guest' ? 'Guests cannot be batch leaders' : 'Toggle batch leader'}
                      className={`p-2 border-2 border-transparent rounded-[var(--radius)] ${
                        u.member_type === 'guest'
                          ? 'text-slate-300 cursor-not-allowed'
                          : `hover:border-[var(--brand-ink)] ${u.is_batch_leader ? 'text-[#b8860b]' : 'text-[var(--brand-ink)]'}`
                      }`}
                    >
                      <Star size={16} />
                    </button>
```

- [ ] **Step 3: Lint**

Run: `cd alumni-frontend && npx eslint src/pages/AdminUsers.jsx` (PowerShell if Bash's `npx` fails)
Expected: no new errors beyond the pre-existing baseline.

- [ ] **Step 4: Build**

Run: `cd alumni-frontend && npm run build` (PowerShell if Bash fails)
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

Start the backend (`npm run dev` in `alumni-backend`) and frontend (`npm run dev` in `alumni-frontend`, PowerShell). Register a new account choosing "Guest", confirm you land on the dashboard. Log in as an admin of that same school, go to Users, confirm the new user shows a "Guest" badge and its star (batch leader) button is visibly disabled with the correct tooltip. Register a second account choosing "Alumnus" and confirm its star button is enabled and toggling it works.

- [ ] **Step 6: Commit**

```bash
git add alumni-frontend/src/pages/AdminUsers.jsx
git commit -m "feat(frontend): show guest/alumnus badge, disable batch-leader toggle for guests"
```
