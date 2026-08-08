# Public AI Chat Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating AI chat widget on the public homepage, usable without logging in, capped at 10 messages per anonymous visitor per school.

**Architecture:** A new public `POST /api/chat` endpoint reuses the existing `generateReply()` AI logic unchanged, gated by an in-memory per-visitor message counter. The frontend gets one new component (`ChatWidget.jsx`) rendered only on `PublicHome.jsx`, holding its own local conversation state and a `localStorage`-persisted anonymous `visitorId`.

**Tech Stack:** Express, existing `lib/ai.js` (OpenAI), React, axios (existing `api` instance).

## Global Constraints

- The OpenAI API key stays server-side — the frontend only ever calls our own `/api/chat`, never OpenAI directly.
- `generateReply()` in `lib/ai.js` is not modified — this feature only adds a new caller of the existing function.
- The 10-message cap is per `${school_id}:${visitorId}`, in-memory (a plain `Map`), not persisted to the database.

---

## Task 1: Backend `POST /api/chat`

**Files:**
- Create: `alumni-backend/src/routes/chat.js`
- Modify: `alumni-backend/src/server.js`
- Test: `alumni-backend/tests/chat.test.js` (new)

**Interfaces:**
- Consumes: `generateReply(history, message, db)` from `../lib/ai` (unchanged).
- Produces: `POST /api/chat` — body `{ history?, message, visitorId }`, response `200 { reply, remaining }`, `400` on missing fields, `429` once a visitor exceeds 10 messages for that school.

- [ ] **Step 1: Create `alumni-backend/src/routes/chat.js`**

```js
const express = require('express');
const { generateReply } = require('../lib/ai');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const MAX_MESSAGES_PER_VISITOR = 10;
const visitorCounts = new Map();

router.post('/chat', asyncHandler(async (req, res) => {
  const { history = [], message, visitorId } = req.body;
  if (!message || !visitorId) {
    return res.status(400).json({ error: 'message and visitorId are required' });
  }

  const key = `${req.school.id}:${visitorId}`;
  const count = visitorCounts.get(key) || 0;
  if (count >= MAX_MESSAGES_PER_VISITOR) {
    return res.status(429).json({ error: "You've reached the question limit for this conversation." });
  }
  visitorCounts.set(key, count + 1);

  const reply = await generateReply(history, message, req.db);
  res.json({ reply, remaining: MAX_MESSAGES_PER_VISITOR - (count + 1) });
}));

module.exports = router;
```

- [ ] **Step 2: Register the route in `server.js`, after `resolveTenant`**

In `alumni-backend/src/server.js`, add after the existing `const schoolRoutes = require('./routes/school'); app.use('/api', schoolRoutes);` block:

```js
const chatRoutes = require('./routes/chat');
app.use('/api', chatRoutes);
```

- [ ] **Step 3: Write the failing tests**

Create `alumni-backend/tests/chat.test.js`:

```js
const request = require('supertest');
const ai = require('../src/lib/ai');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, createSchool, hostFor } = require('./helpers');

afterAll(() => pool.end());

describe('POST /api/chat', () => {
  beforeEach(async () => {
    await resetDb();
    jest.spyOn(ai, 'generateReply').mockResolvedValue('mocked reply');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns a reply for a fresh visitor', async () => {
    const school = await createSchool();
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'When is the next event?', visitorId: 'visitor-1' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('mocked reply');
    expect(res.body.remaining).toBe(9);
  });

  test('missing message returns 400', async () => {
    const school = await createSchool();
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ visitorId: 'visitor-1' });
    expect(res.status).toBe(400);
  });

  test('missing visitorId returns 400', async () => {
    const school = await createSchool();
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'hi' });
    expect(res.status).toBe(400);
  });

  test('the 11th message from the same visitor is rejected and does not call generateReply again', async () => {
    const school = await createSchool();
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/chat')
        .set('Host', hostFor(school))
        .send({ message: `question ${i}`, visitorId: 'capped-visitor' });
      expect(res.status).toBe(200);
    }
    expect(ai.generateReply).toHaveBeenCalledTimes(10);

    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'one more', visitorId: 'capped-visitor' });

    expect(res.status).toBe(429);
    expect(ai.generateReply).toHaveBeenCalledTimes(10);
  });

  test('two different visitorIds on the same school are tracked independently', async () => {
    const school = await createSchool();
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/chat')
        .set('Host', hostFor(school))
        .send({ message: `question ${i}`, visitorId: 'visitor-a' });
    }
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'first question', visitorId: 'visitor-b' });

    expect(res.status).toBe(200);
  });

  test('the same visitorId on two different schools is tracked independently', async () => {
    const schoolA = await createSchool();
    const schoolB = await createSchool();
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/chat')
        .set('Host', hostFor(schoolA))
        .send({ message: `question ${i}`, visitorId: 'shared-visitor' });
    }
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(schoolB))
      .send({ message: 'first question here', visitorId: 'shared-visitor' });

    expect(res.status).toBe(200);
  });
});
```

Note: `jest.spyOn(ai, 'generateReply')` requires `lib/ai.js`'s export to be spy-able — `module.exports = { generateReply, FALLBACK_REPLY, NOT_CONFIGURED_REPLY }` (already the case) and `routes/chat.js` importing it via `const { generateReply } = require('../lib/ai');` both work fine with `jest.spyOn(ai, 'generateReply')` as long as the test imports the whole module (`const ai = require('../src/lib/ai')`) and mocks the property on that object — Jest's module cache means `routes/chat.js`'s destructured reference and the test's `ai.generateReply` point at the same underlying function reference only if the mock replaces the property *before* `chat.js` is required for the first time in the test run. Since `chat.js` destructures `generateReply` at module-load time (`const { generateReply } = require('../lib/ai')`), a `jest.spyOn` applied after that first `require` won't be seen by `chat.js`'s already-bound reference. To make the mock actually take effect, `routes/chat.js` must call `ai.generateReply(...)` through the module object at call time instead of destructuring at load time — replace `chat.js`'s `require` line and the call site as follows:

```js
const ai = require('../lib/ai');
```
and
```js
  const reply = await ai.generateReply(history, message, req.db);
```

- [ ] **Step 4: Run the tests**

```bash
cd alumni-backend
NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand chat.test.js
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add alumni-backend/src/routes/chat.js alumni-backend/src/server.js alumni-backend/tests/chat.test.js
git commit -m "feat(backend): add public AI chat endpoint with per-visitor message cap"
```

---

## Task 2: Frontend `ChatWidget`

**Files:**
- Create: `alumni-frontend/src/components/ChatWidget.jsx`
- Modify: `alumni-frontend/src/pages/PublicHome.jsx`

**Interfaces:**
- Consumes: `api` from `../api`; `Panel, Button, Input` from `./ui` (relative to `components/`).
- Produces: `<ChatWidget />` — no props, self-contained.

- [ ] **Step 1: Create `alumni-frontend/src/components/ChatWidget.jsx`**

```jsx
import { useState } from 'react';
import { Bot, X, Send } from 'lucide-react';
import { api } from '../api';
import { Button, Input } from './ui';

function getVisitorId() {
  let id = localStorage.getItem('chat_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('chat_visitor_id', id);
  }
  return id;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || limitReached) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/chat', { history, message: text, visitorId: getVisitorId() });
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      if (err.response?.status === 429) {
        setLimitReached(true);
        setMessages((m) => [...m, { role: 'assistant', content: err.response.data.error }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: "Sorry, something went wrong. Please try again." }]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="mb-3 w-80 bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--brand-ink)] text-white">
            <span className="font-display text-sm">Ask us anything</span>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2 bg-[var(--brand-surface)]">
            {messages.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">
                Ask about upcoming events, job postings, or the community.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] text-xs ${
                  m.role === 'user' ? 'bg-[var(--brand-accent)] text-white' : 'bg-white text-[var(--brand-ink)]'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="p-2 border-t-[2.5px] border-[var(--brand-ink)] flex gap-2">
            <Input
              className="text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={limitReached ? 'Question limit reached' : 'Type a question...'}
              disabled={sending || limitReached}
            />
            <Button type="submit" disabled={sending || limitReached} className="px-3">
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-accent)] border-[2.5px] border-[var(--brand-ink)] shadow-[4px_4px_0_var(--brand-ink)] flex items-center justify-center text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_var(--brand-ink)] transition-all"
        aria-label="Open AI chat"
      >
        {open ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Render it on `PublicHome.jsx`**

Add the import, alongside the existing component imports:
```jsx
import ChatWidget from '../components/ChatWidget';
```

Add `<ChatWidget />` as the last child of the root `<div>`, right before its closing tag (after the `<footer>` block, still inside the outermost `<div className="min-h-screen" ...>`):

```jsx
      <footer className="border-t-[2.5px] border-[var(--brand-ink)] py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} IHES Alumni Association. Built for lifelong connections.
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd alumni-frontend && node ./node_modules/eslint/bin/eslint.js src/components/ChatWidget.jsx src/pages/PublicHome.jsx` — expect 0 new errors.
Run: `npm run dev`, visit `/` (logged out), click the floating Bot icon, confirm the panel opens, send a message, confirm a reply appears (or the "not configured" fallback if `OPENAI_API_KEY` isn't set locally — that's expected, not a bug). Send 10 messages and confirm the 11th shows the limit-reached message and disables the input.

- [ ] **Step 4: Commit**

```bash
git add alumni-frontend/src/components/ChatWidget.jsx alumni-frontend/src/pages/PublicHome.jsx
git commit -m "feat(frontend): add public AI chat widget to the homepage"
```

---

## Task 3: Final verification

**Files:**
- None (verification-only task).

- [ ] **Step 1: Backend regression**

```bash
cd alumni-backend
NODE_ENV=test node ./node_modules/jest/bin/jest.js --runInBand
```
Expected: 100% pass, including the new `chat.test.js`.

- [ ] **Step 2: Frontend lint and build**

```bash
cd alumni-frontend
node ./node_modules/eslint/bin/eslint.js .
node ./node_modules/vite/bin/vite.js build
```
Expected: no new lint errors beyond the pre-existing baseline, clean production build.

- [ ] **Step 3: Manual end-to-end check**

With both servers running, visit the public homepage on a real school subdomain (e.g. `ihes.localhost:5173`) while logged out. Confirm: the widget renders bottom-right, opens/closes, a sent message gets a reply, the reply reflects live tenant data if asked about it (e.g. "what events are coming up" should mention the school's actual seeded events), and the 10-message cap triggers correctly. Confirm the widget does *not* appear on `/login`, `/register`, or `/signup`.

- [ ] **Step 4: No commit needed** — this task is verification-only.
