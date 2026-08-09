# Required profile photo at registration

## Problem

Alumni can currently create an account (via the paid signup flow in `Register.jsx` / `POST /registration/signup-checkout`) without ever providing a profile photo. `profile_pic` is optional and only ever gets set later, if the alumnus chooses to visit `Profile.jsx` and upload one. Many accounts end up with no photo — showing only an initial-letter avatar everywhere a photo would otherwise appear (directory, admin Users table, the new event-checkin scan details card, the Alumni ID card).

## Goal

A profile photo is required to complete registration — both `alumnus` and `guest` signups. The form cannot be submitted without one, and the account is created with that photo already attached (no separate post-registration upload step needed).

## Non-goals

- No retroactive requirement for existing accounts that currently have no photo — they are unaffected.
- No change to the renewal flow (`RenewRegistration.jsx` / renewal checkout) — renewal is for existing accounts, which already have (or don't have) a photo; unrelated to this change.
- No change to `Profile.jsx`'s own upload/resize behavior — it's reused as-is, not modified.

## Design

### Key fact this design relies on (verified empirically, not assumed)

The signup flow (`alumni-backend/src/routes/registration.js`, `POST /signup-checkout`) currently sends all pending-signup fields (`email`, `password_hash`, `full_name`, `batch_year`, `contact`, `address`, `member_type`, `session_token`) through PayMongo's checkout session `metadata`. The webhook (`paymentsWebhook.js`) reads them back from that metadata once `checkout_session.payment.paid` fires, and only then inserts the `users` row.

Before designing this, it was unclear whether a base64 photo data URL (tens of KB) would fit in PayMongo metadata, since payment processors commonly cap metadata values at a few hundred characters. This was tested directly against PayMongo's live API (not inferred from docs): a single metadata value of **80,000 characters round-tripped with no truncation**. A 400px-resized JPEG at 0.85 quality (the size `Profile.jsx` already produces) is well under that. The backend's `express.json({ limit: '2mb' })` (`server.js`) also already comfortably fits a request body carrying that field. **No architecture change is needed** — `profile_pic` can be added to the existing metadata-passthrough flow exactly like `address` or `full_name` already are.

### Change 1: `Register.jsx` — required photo field

Reuse the exact upload/resize/compress logic already in `alumni-frontend/src/pages/Profile.jsx`'s `onFile` handler: validate the file is an image, reject if over 2MB, resize (via canvas) so the longest side is at most 400px, encode as JPEG at quality 0.85, store the resulting data URL in form state (`form.profile_pic`).

Add a "Profile Photo" field to the `Account` section (next to Full Name / Email / Password / "I am a"), with the same upload-button + preview + remove-photo UI pattern `Profile.jsx` already uses (`Upload`/`Trash2` icons, hidden `<input type="file">` triggered by a styled button).

In `onSubmit`, before calling the API: if `!form.profile_pic`, set an inline error (reusing the existing `err` state / error banner already rendered above the form) and return without submitting — for both `member_type` values, no branching by type.

### Change 2: `POST /registration/signup-checkout` requires `profile_pic`

In `alumni-backend/src/routes/registration.js`, extend the existing required-field check:

```js
const { email, password, full_name, batch_year, contact, address, member_type, profile_pic } = req.body;
if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
```

becomes (new check added, same style/status code as the existing one):

```js
const { email, password, full_name, batch_year, contact, address, member_type, profile_pic } = req.body;
if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
if (!profile_pic) return res.status(400).json({ error: 'A profile photo is required' });
```

Add `profile_pic` to the `metadata` object passed to `paymongo.createCheckoutSession(...)`, alongside the existing `email`, `password_hash`, `full_name`, etc.

### Change 3: webhook creates the user with the photo attached

In `alumni-backend/src/routes/paymentsWebhook.js`, add `profile_pic` to the column list and values of the `INSERT INTO users (...)` statement for the `kind === 'signup'` branch, reading it from `metadata.profile_pic` alongside the other metadata fields already inserted there.

### Data flow

```
Register.jsx: user picks a photo -> resized/compressed client-side -> form.profile_pic (data URL)
  -> submit blocked with inline error if form.profile_pic is empty

POST /registration/signup-checkout
  -> 400 if profile_pic missing (same as missing email/password)
  -> profile_pic included in PayMongo checkout metadata (verified: no size issue)

PayMongo webhook (checkout_session.payment.paid)
  -> INSERT INTO users (..., profile_pic) VALUES (..., metadata.profile_pic)
  -> account created with photo already attached
```

## Testing

- Backend: `POST /registration/signup-checkout` without `profile_pic` returns 400 with an error mentioning the photo (extend `alumni-backend/tests/registration.test.js`, alongside its existing missing-email/password test).
- Backend: a webhook test (extend `alumni-backend/tests/paymentsWebhook.test.js`) confirming a `checkout_session.payment.paid` event whose metadata includes `profile_pic` results in a `users` row with that exact `profile_pic` value.
- Frontend: lint + build (`npx eslint`, `npm run build`) on `Register.jsx`.
- Manual: attempt to submit the registration form with no photo selected — confirm it's blocked with a clear error; complete a registration with a photo — confirm the resulting account (visible in the admin Users table / event scan details card) shows that photo, not an initial.
