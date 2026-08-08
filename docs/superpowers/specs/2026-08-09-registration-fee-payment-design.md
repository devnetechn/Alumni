# Registration Fee Payment (PayMongo) — Design

## Problem

The client wants alumni/guest members to pay a registration fee as part of
creating their account, and to pay again every 2 years to stay active. This
requires a real online payment gateway (PayMongo), not the manual
admin-marks-paid pattern already used for event RSVPs.

## Scope

This is Feature A of a two-part effort (see prior conversation): the
payment engine and expiry gate. Feature B (batch leader verifying that a
paid member actually belongs to their claimed batch) is a separate,
non-blocking follow-up and is **out of scope** for this spec.

Full-stack: schema changes, a PayMongo integration library, new
registration/renewal/webhook routes, an expiry gate in `requireAuth`, and
three new/changed frontend pieces (Register flow, a renewal screen, admin
settings).

## Confirmed PayMongo API facts

Verified against PayMongo's live docs (docs.paymongo.com) during design,
not assumed from memory:

- **Auth**: HTTP Basic, secret key as username, empty password.
- **Create Checkout Session**: `POST https://api.paymongo.com/v1/checkout_sessions`.
  Required: `line_items` (array, 1-999 items, each `{ amount, currency,
  name, quantity }`, amount in centavos) and `payment_method_types`
  (array, min 1 — confirmed valid values include `card`, `gcash`, `qrph`;
  `paymaya` and `grab_pay` are commonly available too but must be verified
  against which channels are actually enabled on the PayMongo account).
  Optional fields used here: `success_url`, `cancel_url`, `metadata`
  (arbitrary object), `reference_number`, `description`.
- **Response**: session id at `data.id`, hosted payment page URL at
  `data.attributes.checkout_url`.
- **Webhook event**: `checkout_session.payment.paid`, delivered to a URL
  registered in Dashboard → Settings → Webhooks. The event carries the
  session's `metadata` and `reference_number` so the handler can locate
  what the payment was for.
- **Signature header**: `Paymongo-Signature`, confirmed to exist and be
  HMAC-based, but PayMongo's public docs did not expose the exact
  algorithm/format at the level of detail needed to hard-code with full
  confidence (their reference page only states the header's *existence*
  and defers to a "Best Practices" section that didn't resolve further).
  **This is a known risk** — the implementation plan must include a step
  that sends a real test webhook from the PayMongo dashboard's
  test-webhook feature (or completes a real sandbox checkout) and confirms
  signature verification actually passes before this is considered done,
  not just "code compiles."

## Data model

```sql
ALTER TABLE schools ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS registration_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_paid_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paymongo_checkout_session_id TEXT;

UPDATE users SET registration_paid_until = now() + interval '2 years' WHERE registration_paid_until IS NULL;
```

- `registration_fee` is stored in **centavos** (PayMongo's own convention
  for all amounts — ₱200.00 = `20000`), displayed as pesos in the UI.
- The one-time `UPDATE ... WHERE registration_paid_until IS NULL` backfill
  grandfathers every existing user (including admins created via the
  platform school-signup flow) with a fresh 2-year window from rollout
  day, so this feature doesn't retroactively lock out everyone already
  using the app. After this backfill, `registration_paid_until` is never
  NULL for a real user — the register-via-payment flow always sets it at
  creation time (see below), so the expiry check can stay a simple
  `< now()` comparison.
- `paymongo_checkout_session_id` correlates a completed session back to
  the user row it created (needed for the post-redirect status-polling
  endpoint described below) and to keep it idempotent (see redriven
  webhook note below).
- `registration_fee = 0` or `registration_open = false` both mean "can't
  pay right now" — checkout-creation endpoints reject with a clear 400
  message rather than ever sending a zero-amount request to PayMongo.

## Backend architecture

**`alumni-backend/src/lib/paymongo.js`** (new) — thin wrapper: `createCheckoutSession({ lineItems, paymentMethodTypes, successUrl, cancelUrl, metadata, referenceNumber })` (returns `{ id, checkoutUrl }`) and `verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)`. Talks to PayMongo via plain `https` requests (no PayMongo SDK exists to depend on — confirmed absent from their docs during this design).

**`alumni-backend/src/routes/registration.js`** (new, mounted at `/api/registration` after `resolveTenant`):
- `POST /signup-checkout` (public) — takes the same fields the trimmed `Register.jsx` form already collects (email, password, full_name, batch_year, contact, address, member_type), validates them the same way `POST /api/auth/register` does today (including the duplicate-email check), hashes the password immediately, and creates a PayMongo checkout session for `req.school.registration_fee` with `metadata: { kind: 'signup', school_id, email, password_hash, full_name, batch_year, contact, address, member_type }`. Rejects 400 if `!req.school.registration_open` or `req.school.registration_fee <= 0`. Returns `{ checkoutUrl }`.
- `GET /signup-checkout/:sessionId/status` (public) — looks up `users` by `paymongo_checkout_session_id = sessionId`. If found, returns `{ ready: true, token, user }` (same shape as today's register/login responses). If not found yet, `{ ready: false }` — the frontend polls this a few times after the PayMongo redirect back, since the webhook may land a moment after the browser redirect does.
- `POST /renew-checkout` (`requireAuth`) — creates a checkout session for `req.school.registration_fee` with `metadata: { kind: 'renewal', school_id, user_id: req.user.id }`. Same `registration_open`/`registration_fee` guard as signup. Returns `{ checkoutUrl }`.

**`alumni-backend/src/routes/paymentsWebhook.js`** (new, mounted in `server.js` **before** `resolveTenant` — like `/api/platform`, since PayMongo's request has no meaningful tenant subdomain):
- `POST /api/payments/webhook` — verifies `Paymongo-Signature` against the raw request body (see the `server.js` change below) using `PAYMONGO_WEBHOOK_SECRET`; 400s on a bad signature. On `checkout_session.payment.paid`:
  - `metadata.kind === 'signup'`: INSERT a new `users` row (school-scoped via `queryForSchool(metadata.school_id, ...)`) with `registration_paid_until = now() + interval '2 years'` and `paymongo_checkout_session_id` set to the session id. Skip if a user with that `paymongo_checkout_session_id` already exists (webhook redelivery is possible and must be idempotent).
  - `metadata.kind === 'renewal'`: `UPDATE users SET registration_paid_until = GREATEST(registration_paid_until, now()) + interval '2 years' WHERE id = metadata.user_id`.

**`server.js`**: add a `verify` callback to the existing `express.json()` call to capture the raw bytes onto `req.rawBody` (needed for signature verification, since Express's JSON parser normally discards the original bytes):
```js
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
```
This is additive — every other route keeps working exactly as today.

**`alumni-backend/src/middleware/auth.js`** (`requireAuth`): after `req.user` is set, add the expiry gate (mirrors the existing `trialExpired` pattern in `tenant.js`, but per-user instead of per-school):
```js
const REGISTRATION_ALLOWLIST = ['/api/me', '/api/school', '/api/registration/renew-checkout'];
if (user.registration_paid_until && new Date(user.registration_paid_until) < new Date() && !REGISTRATION_ALLOWLIST.includes(req.path)) {
  return res.status(402).json({ error: 'Registration expired', registrationPaidUntil: user.registration_paid_until });
}
```

**`alumni-backend/src/routes/school.js`** (`GET /api/school`, already public): add `registration_open` and `registration_fee` to its response so the frontend can show the fee/availability before the user logs in.

**`alumni-backend/src/routes/admin.js`**: new `PATCH /api/admin/school` (`requireAdmin`) to update `registration_open`/`registration_fee`.

## Frontend architecture

- **`Register.jsx`**: submit now calls `POST /registration/signup-checkout` instead of `POST /auth/register`, then `window.location.href = checkoutUrl`. Shows the fee (from `GET /school`) and a "registration is currently closed" message in place of the form when `!registration_open`.
- **`RegisterSuccess.jsx`** (new page, PayMongo `success_url` target) — polls `GET /registration/signup-checkout/:sessionId/status` every ~2s (a few attempts, with a timeout message if it never resolves) until `ready: true`, then stores the returned token and redirects to `/dashboard`.
- **`RenewRegistration.jsx`** (new page) — same visual pattern as the existing `TrialExpired.jsx`, but with a real "Pay ₱X to Renew" button that calls `POST /registration/renew-checkout` and redirects to the returned `checkoutUrl`.
- **`App.jsx`**: add a `registrationExpired` computed value (`user.registration_paid_until && new Date(user.registration_paid_until) < new Date()`, no extra fetch needed — `registration_paid_until` is already on the `/me` user object) next to the existing `trialExpired` check in `Shell`, rendering `<RenewRegistration />` instead of children when true.
- **Admin settings**: add a "Registration" panel at the top of `AdminUsers.jsx` (above the existing user table — that page is already the admin's "accounts, roles, and membership status" surface, per its own subtitle) with the `registration_open` toggle and `registration_fee` peso input, wired to the new `PATCH /api/admin/school`.

## Out of scope

- Feature B (batch leader verification) — separate spec/plan.
- No refund handling.
- No support for other PayMongo payment intent flows (raw card tokenization, sources API) — Checkout Sessions only.
- No email receipts (`send_email_receipt` left `false`/default) — PayMongo's hosted page already shows a confirmation.
