const express = require('express');
const crypto = require('crypto');
const { asyncHandler } = require('../lib/asyncHandler');
const { hashPassword } = require('../lib/password');
const { signToken } = require('../lib/token');
const { requireAuth } = require('../middleware/auth');
const paymongo = require('../lib/paymongo');

const router = express.Router();

router.post('/signup-checkout', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, contact, address, member_type, profile_pic } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (!profile_pic) return res.status(400).json({ error: 'A profile photo is required' });

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
    `INSERT INTO pending_signups (session_token, school_id, email, password_hash, full_name, batch_year, contact, address, member_type, profile_pic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      sessionToken,
      req.school.id,
      email,
      password_hash,
      full_name || null,
      batch_year || null,
      contact || null,
      address || null,
      resolvedMemberType,
      profile_pic,
    ]
  );

  const session = await paymongo.createCheckoutSession({
    lineItems: [{
      amount: req.school.registration_fee,
      currency: 'PHP',
      name: 'Alumni Registration Fee',
      quantity: 1,
    }],
    paymentMethodTypes: ['card', 'gcash', 'paymaya', 'grab_pay'],
    successUrl: `${req.protocol}://${req.headers.host}/register/success?session_id=${sessionToken}`,
    cancelUrl: `${req.protocol}://${req.headers.host}/register`,
    metadata: {
      kind: 'signup',
      school_id: String(req.school.id),
      session_token: sessionToken,
    },
  });

  res.json({ checkoutUrl: session.checkoutUrl });
}));

router.get('/signup-checkout/:sessionId/status', asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM users WHERE paymongo_checkout_session_id = $1', [req.params.sessionId]);
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
    paymentMethodTypes: ['card', 'gcash', 'paymaya', 'grab_pay'],
    successUrl: `${req.protocol}://${req.headers.host}/dashboard`,
    cancelUrl: `${req.protocol}://${req.headers.host}/dashboard`,
    metadata: {
      kind: 'renewal',
      school_id: String(req.school.id),
      user_id: String(req.user.id),
    },
  });

  res.json({ checkoutUrl: session.checkoutUrl });
}));

module.exports = router;
