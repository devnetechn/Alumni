# AI Support Bot in Messages — Design

**Date:** 2026-08-07
**Scope:** `alumni-backend` (new AI/tool-calling module, a schema change, and a `messages.js` route change) and `alumni-frontend` (small `Messages.jsx` UX additions). No new pages, no new database tables.

## Problem

Alumni using the system have no way to get quick help ("how do I RSVP to an event?", "what jobs are open right now?") without messaging a human admin. The user has an OpenAI API key and wants a real-time AI assistant reachable the same way alumni already reach each other — through Messages.

## Goals

- A reserved "bot" account that any logged-in user can message, always visible at the top of their conversation list (even with zero messages exchanged).
- The bot answers general how-to-use-the-site questions and can answer questions that require live data (upcoming events, open jobs, aggregate stats) by querying the real database, not a static script.
- Replies arrive the same way a human's reply would — inserted as a `messages` row and pushed over the existing Socket.io `message:new` event — so no new transport or UI paradigm is introduced.
- Configurable via `.env` (API key, model name) so it can be swapped/tuned without a code change.

## Non-goals

- No new database tables, no new frontend page/route, no admin UI for managing the bot or its knowledge.
- No streaming token-by-token output (the reply is generated, saved, and emitted as one complete message — see Testing/Error handling for why a synchronous, non-streamed call is the right choice here).
- No multi-turn tool-calling loops beyond one round of function calls before the final answer (see Architecture).
- Not responsible for content moderation beyond what OpenAI's API itself provides.

## Architecture

### Data model

One migration-equivalent change to `db/schema.sql`: add `is_bot BOOLEAN NOT NULL DEFAULT false` to `users`. `db/seed.js` gains one more idempotent (`ON CONFLICT (email) DO NOTHING`) insert: a reserved bot account —

```
email: bot@ihes.local
full_name: "IHES Assistant"
is_bot: true
active: true
role: alumni   (no special permissions — it's a conversation partner, not an admin)
```

The bot's `id` is looked up by its known email at request time (not hardcoded as `1`), the same pattern the seed script already uses for the admin/created_by lookups.

### Backend: `src/lib/ai.js`

A new module exporting `async function generateReply(history, userMessage)`:

- Wraps the OpenAI Chat Completions API (Node `openai` SDK, added as a new `alumni-backend` dependency).
- Defines 3 read-only "tools" (function-calling definitions) the model can call:
  - `get_upcoming_events()` → next 5 events ordered by date, via the existing `events` table.
  - `get_open_jobs()` → latest 5 job postings, via the existing `jobs` table.
  - `get_stats()` → `{ totalAlumni, totalEvents }`, a trimmed read from the same aggregate queries `stats.js` already has (reused, not duplicated — `ai.js` imports the two count queries, not the whole trend-building machinery).
- Tool implementations reuse the existing `query()` helper from `src/db.js` — same DB, same connection pool, no new data access layer.
- One tool-calling round only: send the user's message + short conversation history + system prompt (site description, tone, "you are the IHES Alumni Association assistant") → if the model requests a tool call, execute it, feed the result back, get the final text answer. This bounds latency and matches the "answer questions using live data" goal without building a general agent loop.
- Returns plain text. If the OpenAI call throws (network error, missing/invalid key, rate limit) or times out, `generateReply` catches it internally and returns a fixed fallback string rather than throwing — the caller (the route handler) always gets a string back, never has to special-case failure.

### Backend: `messages.js` change

In `POST /messages`, after the existing insert + `emitToUser(receiver_id, 'message:new', message)` + (from the earlier notification fix) `createNotification(...)`:

```
if receiver is the bot account:
  fetch the last ~10 messages between this user and the bot (for context)
  reply = await generateReply(history, body)
  insert a new messages row: sender_id = bot.id, receiver_id = req.user.id, body = reply
  emitToUser(req.user.id, 'message:new', thatRow)
```

This happens inside the same request/response cycle — the HTTP response to the user's own message returns immediately after their message is saved (unchanged from today), and the bot's reply arrives moments later purely over the socket, exactly like waiting for a slow human to type back. No polling, no separate endpoint.

### Frontend: `Messages.jsx`

- `GET /messages` (conversation list) already returns real conversations; the bot won't appear there until a message exists. Since the design calls for the bot to be pinned even with zero history, the frontend prepends a synthetic "IHES Assistant" entry to the fetched conversation list if it isn't already present (looked up via a small, cheap backend addition: the existing `GET /me` response — or a new tiny public-ish field — exposes the bot's id/name so the frontend doesn't hardcode it). Opening that synthetic entry behaves exactly like opening any other thread; if no messages exist yet, `GET /messages/:userId` already returns an empty array today, so the thread view just starts blank.
- While waiting for the bot's reply (between sending a message to the bot and the `message:new` socket event arriving for that thread), show a small "IHES Assistant is typing…" indicator under the thread — a local `useState` flag set on send-to-bot and cleared when the matching socket event lands (or after a timeout, in case the fallback path above still took a few seconds).

## Data flow

1. User opens Messages, sees "IHES Assistant" pinned at the top, clicks it.
2. User types a question, hits send → existing `POST /messages` flow (unchanged wire format).
3. Backend detects the recipient is the bot, calls `generateReply` (tool-calling against live DB data as needed), saves the reply as a normal message row, emits it over the user's existing socket room.
4. Frontend's existing `message:new` listener (from the earlier Socket.io wiring) picks it up and appends it to the open thread — no bot-specific frontend socket code needed beyond the typing indicator.

## Error handling

- Missing `OPENAI_API_KEY`: `ai.js` checks for it at module load (consistent with the existing fail-fast pattern for `JWT_SECRET`/`DATABASE_URL`) and disables the bot gracefully rather than crashing the server — `generateReply` short-circuits to a fixed "the assistant isn't configured yet" string instead of ever calling the API, if the key is absent. The rest of the app (including messaging humans) is unaffected either way.
- OpenAI API error/timeout at request time: caught inside `generateReply`, returns a fallback apology string — the user still gets *a* reply, just not an AI-generated one, so the thread never hangs indefinitely.
- A tool call itself failing (a DB error inside `get_upcoming_events` etc.): caught at the tool-execution layer inside `ai.js`, the tool returns an empty/error result to the model rather than throwing, so the model can still respond ("I couldn't check that right now, but...") instead of the whole reply failing.

## Testing

- `ai.js`'s OpenAI client is injected/mockable (module exports accept an optional client override, defaulting to a real one) so `tests/ai.test.js` can stub responses and tool-call sequences without ever hitting the real API or costing money.
- `messages.test.js` gains a test that sends a message to the bot's id and asserts a second message (bot → user) appears, using the mocked `ai.js`.
- No test depends on network access or a real `OPENAI_API_KEY`.

## Open items for later (explicitly out of scope now)

- Actual OpenAI model choice is left to `.env` (`OPENAI_MODEL`), no default enforced in code beyond a reasonable fallback if unset.
- Rate-limiting/abuse protection on the bot endpoint isn't addressed — fine for a small internal alumni tool, revisit if it's ever exposed more broadly.
