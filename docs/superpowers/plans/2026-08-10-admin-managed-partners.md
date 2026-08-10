# Admin-Managed Partners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Partnerships content with a real admin-managed `partners` table, exposed via a public GET endpoint and an admin CRUD (create/delete) UI, and wire the homepage section to real data.

**Architecture:** New `partners` table (mirrors `event_photos`/`announcements` conventions: base64 image storage, RLS tenant isolation, admin-only writes). New backend route file, new admin page, new homepage section component receiving real data as a prop from `PublicHome.jsx`.

**Tech Stack:** Express, PostgreSQL, Jest + Supertest (backend), React, existing `lib/media.js` upload helpers (frontend).

## Global Constraints

- No edit capability — delete and re-add, matching the `announcements` pattern.
- `logo` is optional — a partner can exist with just a name.
- Don't commit until explicitly asked (standing agreement for this session).

---

### Task 1: Backend schema + routes (TDD)

**Files:**
- Modify: `alumni-backend/db/schema.sql`
- Modify: `alumni-backend/tests/helpers.js`
- Create: `alumni-backend/src/routes/partners.js`
- Modify: `alumni-backend/src/server.js`
- Create: `alumni-backend/tests/partners.test.js`

**Interfaces:**
- Produces: `GET /api/partners` (public), `POST /api/partners` (admin), `DELETE /api/partners/:id` (admin) — consumed by the frontend in Task 3.

- [ ] **Step 1: Add the `partners` table to schema.sql**

Append to `alumni-backend/db/schema.sql` (after the `GRANT ALL ON event_photos...` line at the end):

```sql
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON partners;
CREATE POLICY tenant_isolation ON partners
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

GRANT ALL ON partners, partners_id_seq TO alumni_app;
```

- [ ] **Step 2: Run the migration locally**

Run: `cd alumni-backend && npm run migrate`
Expected: `Migration complete.`

- [ ] **Step 3: Add `partners` to the test DB reset list**

In `alumni-backend/tests/helpers.js`, add `partners` to the `TRUNCATE TABLE` list (line 10-15), e.g. right after `event_photos,`:

```js
  await pool.query(`
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_photos, partners, event_checkins, event_rsvps, events, users, schools, platform_admins,
      processed_webhook_events, pending_signups
    RESTART IDENTITY CASCADE
  `);
```

- [ ] **Step 4: Write the failing tests**

Create `alumni-backend/tests/partners.test.js`:

```js
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('GET /api/partners is public and starts empty', async () => {
  const school = await getDefaultSchool();
  const res = await request(app).get('/api/partners').set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.partners).toEqual([]);
});

test('POST /api/partners requires admin', async () => {
  const alumni = await insertUser({ role: 'alumni' });
  const res = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(alumni))
    .send({ name: 'Not Allowed' });
  expect(res.status).toBe(403);
});

test('POST /api/partners requires a name', async () => {
  const admin = await insertUser({ role: 'admin' });
  const res = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ website_url: 'https://example.com' });
  expect(res.status).toBe(400);
});

test('admin can create a partner without a logo, then delete it', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Local Bakery', website_url: 'https://example.com' });
  expect(create.status).toBe(201);
  expect(create.body.partner.name).toBe('Local Bakery');
  expect(create.body.partner.logo).toBeNull();

  const school = await getDefaultSchool();
  const list = await request(app).get('/api/partners').set('Host', hostFor(school));
  expect(list.body.partners.length).toBe(1);

  const del = await request(app)
    .delete(`/api/partners/${create.body.partner.id}`)
    .set('Authorization', authHeader(admin));
  expect(del.status).toBe(204);

  const listAfter = await request(app).get('/api/partners').set('Host', hostFor(school));
  expect(listAfter.body.partners.length).toBe(0);
});

test('admin can create a partner with a logo', async () => {
  const admin = await insertUser({ role: 'admin' });
  const create = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Tech Co', logo: 'data:image/jpeg;base64,ZmFrZQ==' });
  expect(create.status).toBe(201);
  expect(create.body.partner.logo).toBe('data:image/jpeg;base64,ZmFrZQ==');
});

test('DELETE /api/partners/:id requires admin', async () => {
  const admin = await insertUser({ role: 'admin' });
  const alumni = await insertUser({ role: 'alumni' });
  const create = await request(app)
    .post('/api/partners')
    .set('Authorization', authHeader(admin))
    .send({ name: 'Protected Co' });

  const res = await request(app)
    .delete(`/api/partners/${create.body.partner.id}`)
    .set('Authorization', authHeader(alumni));
  expect(res.status).toBe(403);
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd alumni-backend && npx cross-env NODE_ENV=test npx jest tests/partners.test.js --runInBand`
Expected: FAIL — route doesn't exist yet (404s / `Cannot find module`).

- [ ] **Step 6: Implement the routes**

Create `alumni-backend/src/routes/partners.js`:

```js
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM partners ORDER BY created_at DESC');
  res.json({ partners: rows });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, logo, website_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await req.db(
    `INSERT INTO partners (school_id, name, logo, website_url) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, name, logo || null, website_url || null]
  );
  res.status(201).json({ partner: rows[0] });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM partners WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
```

Wire it into `alumni-backend/src/server.js` — add near the other tenant-scoped routes (after the `announcementsRoutes` mount, keeping alphabetical-ish grouping consistent with the rest of the file):

```js
const partnersRoutes = require('./routes/partners');
app.use('/api/partners', partnersRoutes);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd alumni-backend && npx cross-env NODE_ENV=test npx jest tests/partners.test.js --runInBand`
Expected: all PASS.

- [ ] **Step 8: Apply the migration to Supabase too**

The production Supabase database (set up earlier today) also needs this table. Run:

```bash
cd alumni-backend
DATABASE_URL="postgresql://postgres.npawsxoehgzqadulndnv:uK6TuZZMuAEYJUEQ@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres" npm run migrate
```

Expected: `Migration complete.` (idempotent — safe to re-run against the already-migrated Supabase DB).

---

### Task 2: Admin Partnerships page

**Files:**
- Create: `alumni-frontend/src/pages/AdminPartnerships.jsx`
- Modify: `alumni-frontend/src/App.jsx`

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/partners` (Task 1), `validateFile`/`resizeImage` from `lib/media.js` (existing).
- Produces: route `/admin/partnerships`, nav entry.

- [ ] **Step 1: Create the admin page**

```jsx
import { useEffect, useRef, useState } from 'react';
import { Handshake, Trash2, Upload, Building2 } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from '../components/ui';
import { validateFile, resizeImage } from '../lib/media';

export default function AdminPartnerships() {
  const [partners, setPartners] = useState([]);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logo, setLogo] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const load = () => api.get('/partners').then((r) => setPartners(r.data.partners));

  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationErr = validateFile(file, 2 * 1024 * 1024);
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
    setLogo(dataUrl);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    try {
      await api.post('/partners', { name, website_url: websiteUrl || null, logo: logo || null });
      setName('');
      setWebsiteUrl('');
      setLogo('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to add partner');
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this partner?')) return;
    await api.delete(`/partners/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Handshake className="text-[var(--brand-accent)]" /> Partnerships
        </h1>
        <p className="text-slate-500 mt-1">Manage the organizations shown on the homepage.</p>
      </div>

      <Panel className="p-6 mb-8">
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <p className="text-sm text-[var(--brand-danger)] font-semibold">{err}</p>}
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Website (optional)</label>
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[var(--radius)] bg-[var(--brand-surface)] border-2 border-[var(--brand-ink)] overflow-hidden flex items-center justify-center flex-shrink-0">
              {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : <Building2 className="text-slate-400" size={20} />}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Upload Logo
            </Button>
          </div>
          <Button type="submit" variant="primary">Add Partner</Button>
        </form>
      </Panel>

      {partners.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500">No partners yet.</Panel>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => (
            <Panel key={p.id} className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--brand-surface)] border-2 border-[var(--brand-ink)] overflow-hidden flex items-center justify-center flex-shrink-0">
                {p.logo ? <img src={p.logo} alt="" className="w-full h-full object-cover" /> : <Building2 className="text-slate-400" size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--brand-ink)] truncate">{p.name}</p>
                {p.website_url && <p className="text-xs text-slate-500 truncate">{p.website_url}</p>}
              </div>
              <button onClick={() => remove(p.id)} className="p-2 text-[var(--brand-danger)] hover:bg-red-50 rounded-[var(--radius)]">
                <Trash2 size={16} />
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route and nav entry**

In `alumni-frontend/src/App.jsx`, add the import near `AdminHighlights`:

```jsx
import AdminPartnerships from './pages/AdminPartnerships';
```

Add to `navItems` (after the `/admin/highlights` entry), using the same `Handshake` icon already used on the homepage's Give Back section:

```jsx
  { to: '/admin/partnerships', label: 'Partnerships', icon: Handshake, adminOnly: true },
```

Add `Handshake` to the `lucide-react` import list at the top of `App.jsx`.

Add the route (near `/admin/highlights`'s route):

```jsx
<Route path="/admin/partnerships" element={<Protected><AdminPartnerships /></Protected>} />
```

- [ ] **Step 3: Verify**

Log in as an admin locally, visit `/admin/partnerships`, add a partner with and without a logo, confirm both appear in the list, delete one and confirm it disappears.

---

### Task 3: Homepage Partnerships section (real data)

**Files:**
- Create: `alumni-frontend/src/components/home/Partnerships.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `partners` prop — `{ id, name, logo, website_url }[]` from a new `api.get('/partners')` call in `PublicHome.jsx`.
- Produces: default export `Partnerships`, a `<section>`. Returns `null` when `partners.length === 0` (same empty-state-safe pattern as `SchoolMemories`).

- [ ] **Step 1: Create the component**

```jsx
import { motion } from 'framer-motion';
import { Handshake, Building2 } from 'lucide-react';

const sectionFade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.05, ease: 'easeOut' },
  }),
};

export default function Partnerships({ partners }) {
  if (partners.length === 0) return null;

  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <div className="flex items-center gap-3 mb-8">
        <Handshake className="text-[var(--brand-accent)]" size={26} />
        <h2 className="font-editorial text-3xl md:text-4xl text-[var(--brand-ink)]">Partnerships</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {partners.map((p, i) => {
          const card = (
            <motion.div
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className="bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-8 flex flex-col items-center justify-center gap-3 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
            >
              {p.logo ? (
                <img src={p.logo} alt="" className="w-12 h-12 object-cover rounded-[var(--radius)]" />
              ) : (
                <Building2 className="text-slate-400" size={32} />
              )}
              <p className="text-sm font-semibold text-slate-500 text-center">{p.name}</p>
            </motion.div>
          );
          return p.website_url ? (
            <a key={p.id} href={p.website_url} target="_blank" rel="noreferrer">{card}</a>
          ) : (
            <div key={p.id}>{card}</div>
          );
        })}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Fetch real data and wire into `PublicHome.jsx`**

Add a `partners` state and fetch, matching the existing `highlights` pattern:

```jsx
  const [partners, setPartners] = useState([]);
```

In the data-fetching `useEffect`, add:

```jsx
    api.get('/partners').then((r) => setPartners(r.data.partners));
```

Add the import: `import Partnerships from '../components/home/Partnerships';`

Render `<Partnerships partners={partners} />` between `<AlumniImpact stats={stats} />` and `<GiveBack />`.

- [ ] **Step 3: Verify**

Reload the homepage. With no partners in the DB, confirm the section doesn't render (no gap/empty section). Add a partner via `/admin/partnerships`, reload, confirm it now appears with its logo (or the `Building2` fallback icon) and links out to its website if one was set.

## Commit checkpoint

Per this session's working agreement, do not run `git add`/`git commit`/`git push` for any step above until the user explicitly asks for it.
