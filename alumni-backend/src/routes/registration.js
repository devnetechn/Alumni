const express = require('express');
const crypto = require('crypto');
const { asyncHandler } = require('../lib/asyncHandler');
const { hashPassword } = require('../lib/password');
const { signToken } = require('../lib/token');
const { requireAuth } = require('../middleware/auth');
const paymongo = require('../lib/paymongo');
const { fulfilPendingSignup } = require('../lib/signupFulfilment');

const router = express.Router();

// The frontend and backend are separate origins in production (e.g. Vercel
// + Render), so req.headers.host is the *backend's* own host there, not the
// frontend's -- unlike local dev, where Vite's proxy (no changeOrigin, see
// vite.config.js) preserves the original browser Host header, making the
// two coincide. FRONTEND_URL makes the real frontend origin explicit;
// falling back to req.protocol/req.headers.host keeps local dev unchanged.
function frontendOrigin(req) {
  return process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host}`;
}

router.post('/signup-checkout', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, contact, address, member_type, profile_pic, batch_id, course, requested_batch_year } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  let batch = null;
  if (batch_id) {
    batch = (await req.db('SELECT * FROM batches WHERE id = $1', [batch_id]))[0];
    if (!batch) return res.status(400).json({ error: 'The selected batch does not exist' });
  }
  // Registrants whose batch is not listed yet still pay first; the admin
  // creates the batch and assigns them afterwards.
  const requestedYear = !batch && requested_batch_year ? parseInt(requested_batch_year, 10) : null;
  if (requested_batch_year && !batch && !(requestedYear >= 1900 && requestedYear <= 2100)) {
    return res.status(400).json({ error: 'Enter a valid graduation year' });
  }

  if (!req.school.registration_open) {
    return res.status(400).json({ error: 'Registration is currently closed' });
  }
  if (!req.school.registration_fee || req.school.registration_fee <= 0) {
    return res.status(400).json({ error: 'Registration fee has not been configured yet' });
  }

  const resolvedMemberType = member_type || 'alumnus';
  if (!['alumnus', 'guest'].includes(resolvedMemberType)) {
    return res.status(400).json({ error: 'member_type must be alumnus or guest' });
  }

  const existing = await req.db('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await hashPassword(password);

  // PayMongo does not substitute a {CHECKOUT_SESSION_ID}-style placeholder in
  // success_url (confirmed via manual testing — unlike Stripe's convention,
  // it passes the literal string through unresolved). Mint our own
  // correlation token instead, since the real PayMongo session id isn't
  // known until after this call returns.
  const sessionToken = crypto.randomUUID();

  // PayMongo's checkout metadata has an undocumented size/entropy limit
  // that a real (high-entropy) value like a base64 photo blows past well
  // under 10KB, even though low-entropy strings of the same length pass
  // fine (confirmed via direct testing against their API). Stage the full
  // signup here instead, keyed by session_token, and pass only that small,
  // low-entropy token through PayMongo metadata; the webhook reads the
  // rest back from this table.
  await req.db(
    `INSERT INTO pending_signups (session_token, school_id, email, password_hash, full_name, batch_year, contact, address, member_type, profile_pic, batch_id, course, requested_batch_year)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      sessionToken,
      req.school.id,
      email,
      password_hash,
      full_name || null,
      batch ? batch.year : (batch_year || requestedYear || null),
      contact || null,
      address || null,
      resolvedMemberType,
      profile_pic || null,
      batch ? batch.id : null,
      course || null,
      requestedYear,
    ]
  );

  const session = await paymongo.createCheckoutSession({
    lineItems: [{
      amount: req.school.registration_fee,
      currency: 'PHP',
      name: 'Alumni Registration Fee',
      quantity: 1,
    }],
    paymentMethodTypes: paymongo.paymentMethods(),
    successUrl: `${frontendOrigin(req)}/register/success?session_id=${sessionToken}`,
    cancelUrl: `${frontendOrigin(req)}/register`,
    metadata: {
      kind: 'signup',
      school_id: String(req.school.id),
      session_token: sessionToken,
    },
  });

  await req.db('UPDATE pending_signups SET paymongo_session_id = $1 WHERE session_token = $2', [session.id, sessionToken]);

  res.json({ checkoutUrl: session.checkoutUrl, sessionToken });
}));

// Webhooks can arrive late (or after a cold start), so the status poll also
// asks PayMongo directly, at most once per interval per signup (so duplicate tabs don't spam it).
const PAYMONGO_CHECK_INTERVAL_MS = 1500; // just under the frontend's 2s poll so every poll checks
const lastPaymongoCheck = new Map();

async function confirmSignupWithPaymongo(req, sessionToken) {
  const last = lastPaymongoCheck.get(sessionToken) || 0;
  if (Date.now() - last < PAYMONGO_CHECK_INTERVAL_MS) return;
  lastPaymongoCheck.set(sessionToken, Date.now());
  if (lastPaymongoCheck.size > 1000) lastPaymongoCheck.delete(lastPaymongoCheck.keys().next().value);

  const [pending] = await req.db('SELECT paymongo_session_id FROM pending_signups WHERE session_token = $1', [sessionToken]);
  if (!pending || !pending.paymongo_session_id) return;
  try {
    const session = await paymongo.getCheckoutSession(pending.paymongo_session_id);
    if (paymongo.isCheckoutPaid(session)) await fulfilPendingSignup(req.school.id, sessionToken);
  } catch (err) {
    console.error('PayMongo signup status check failed:', err.message); // the webhook is still the backstop
  }
}

router.get('/signup-checkout/:sessionId/status', asyncHandler(async (req, res) => {
  const findUser = () => req.db('SELECT * FROM users WHERE paymongo_checkout_session_id = $1', [req.params.sessionId]);
  let rows = await findUser();
  if (rows.length === 0) {
    await confirmSignupWithPaymongo(req, req.params.sessionId);
    rows = await findUser();
  }
  if (rows.length === 0) return res.json({ ready: false });

  const user = rows[0];
  delete user.password_hash;
  res.json({ ready: true, token: signToken(user), user });
}));

router.post('/renew-checkout', requireAuth, asyncHandler(async (req, res) => {
  if (!req.school.registration_open) {
    return res.status(400).json({ error: 'Registration is currently closed' });
  }
  if (!req.school.registration_fee || req.school.registration_fee <= 0) {
    return res.status(400).json({ error: 'Registration fee has not been configured yet' });
  }

  const session = await paymongo.createCheckoutSession({
    lineItems: [{
      amount: req.school.registration_fee,
      currency: 'PHP',
      name: 'Alumni Registration Renewal',
      quantity: 1,
    }],
    paymentMethodTypes: paymongo.paymentMethods(),
    successUrl: `${frontendOrigin(req)}/dashboard`,
    cancelUrl: `${frontendOrigin(req)}/dashboard`,
    metadata: {
      kind: 'renewal',
      school_id: String(req.school.id),
      user_id: String(req.user.id),
    },
  });

  res.json({ checkoutUrl: session.checkoutUrl });
}));

module.exports = router;
