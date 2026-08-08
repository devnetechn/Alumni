# Public AI Chat Widget — Design

**Date:** 2026-08-08
**Scope:** `alumni-backend` (new public `POST /api/chat` endpoint, reusing the existing AI reply logic) and `alumni-frontend` (a floating chat widget on `PublicHome.jsx` only).

## Problem

The AI assistant ("IHES Assistant") currently only exists inside the Messages page, reachable by logged-in alumni messaging the bot account directly. There's no way for a logged-out visitor on the public homepage to ask it anything — and the homepage is exactly where a prospective alumni or a school evaluating the platform would want a quick, no-signup way to ask "when's the next event" or "what jobs are posted."

## Goals

- A floating AI icon on `PublicHome.jsx` opens a small chat panel, usable without logging in or creating an account.
- Reuses the existing `generateReply()` AI logic and its existing tools (upcoming events, open jobs, aggregate stats) unchanged — no new capabilities, no access to anything not already tenant-scoped and non-personal.
- The OpenAI API key never reaches the browser — the widget talks only to our own backend, which is the only thing that ever calls OpenAI, exactly as it already works for the logged-in Messages flow.
- Each anonymous visitor is capped at 10 messages (per school, tracked by a random client-generated ID stored in `localStorage`, not an account) to bound API cost from casual abuse.

## Non-goals

- No conversation persistence — an anonymous chat lives only in the browser tab's state; refreshing loses it (matches "no account" — there's nowhere to save it to).
- No changes to the AI's tools or system prompt, and no new tools added for this pass.
- No widget anywhere except `PublicHome.jsx` — not on Login/Register/Signup, not inside the authenticated app (which already has the full Messages-based bot conversation).
- No robust abuse prevention (IP-based, CAPTCHA, etc.) — the 10-message-per-visitor cap is a casual deterrent, easily bypassed by clearing `localStorage`, same honesty-about-limits precedent as the earlier public signup endpoint's lack of rate-limiting.
- No behavior change for the trial-expiry lock — `/api/chat` sits alongside the rest of the tenant-scoped routes and is subject to the same `402` trial-expired gate as everything else the public homepage already calls (`/api/announcements`, `/api/events`, `/api/stats`); no special-casing either way.

## Architecture

### Backend: `POST /api/chat`

New `alumni-backend/src/routes/chat.js`, registered in `server.js` after `resolveTenant` (needs `req.school`/`req.db`) but without `requireAuth`:

```js
const express = require('express');
const { generateReply } = require('../lib/ai');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const MAX_MESSAGES_PER_VISITOR = 10;
const visitorCounts = new Map(); // `${school_id}:${visitorId}` -> count, in-memory, resets on restart

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

`generateReply(history, message, db)` (in `lib/ai.js`) is used completely unchanged — it already takes conversation history and a tenant-scoped `db` function as plain parameters, with no dependency on a logged-in user, which is exactly the shape a stateless anonymous request needs.

### Frontend: `ChatWidget.jsx`

New `alumni-frontend/src/components/ChatWidget.jsx`, rendered only inside `PublicHome.jsx`:

- A fixed-position circular/square button (bottom-right, `Bot` icon from `lucide-react`, brutalist border+shadow) that toggles a small chat panel.
- On first render, reads/creates a `visitorId` in `localStorage` (`crypto.randomUUID()` if absent).
- Local component state holds the message list (`{ role: 'user' | 'assistant', content }[]`); sending a message posts `{ history, message, visitorId }` to `/api/chat` via the existing `api` instance (no auth token exists for an anonymous visitor, so the request interceptor simply sends the request without an `Authorization` header — no special-casing needed there).
- On a `429`, the panel shows the limit-reached message and disables the input instead of retrying.

## Data flow

1. Visitor opens the widget, types a question.
2. Frontend posts `{ history, message, visitorId }` to `/api/chat` (tenant-resolved via the subdomain, same as every other request).
3. Backend checks the visitor's message count for this school; if under 10, calls `generateReply`, increments the count, returns the reply.
4. Frontend appends both the user's message and the reply to local state and re-renders — nothing is written to the database.

## Error handling

- Missing `message`/`visitorId`: `400`.
- Visitor at or past the 10-message cap: `429`, frontend shows the limit message and disables further input for that session.
- OpenAI unreachable/erroring, or `OPENAI_API_KEY` unset: unchanged from the existing behavior — `generateReply` already catches errors internally and returns `FALLBACK_REPLY`/`NOT_CONFIGURED_REPLY`, so `/api/chat` always returns `200` with *some* reply rather than a `500` in that case.
- Trial-expired school: `402` from `resolveTenant`, same as any other route on that subdomain — the widget doesn't need special handling since this matches the (pre-existing, unrelated) behavior of the rest of the public homepage's data calls on an expired-trial school.

## Testing

- `POST /api/chat` returns a reply for a fresh visitor and increments their count.
- The 11th message from the same `visitorId` (same school) returns `429` and does not call `generateReply` again (verified by call count, not just status code).
- Two different `visitorId`s (or the same `visitorId` on two different schools) are tracked independently — one hitting the cap doesn't affect the other.
- Missing `message` or `visitorId` returns `400`.
- Manual frontend check: widget opens/closes, sends a message, shows the reply, hits the cap after 10 messages and disables input with the limit message.

## Open items for later (explicitly out of scope now)

- Persisting anonymous conversations.
- The widget appearing anywhere besides `PublicHome.jsx`.
- Stronger abuse prevention (IP-based limits, CAPTCHA) if this ever needs to hold up under real public traffic.
