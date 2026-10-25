const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { query, queryForSchool } = require('../db');
const paymongo = require('../lib/paymongo');
const { fulfilPendingSignup } = require('../lib/signupFulfilment');

const router = express.Router();

router.post('/webhook', asyncHandler(async (req, res) => {
  const signatureHeader = req.headers['paymongo-signature'];
  const valid = paymongo.verifyWebhookSignature(req.rawBody, signatureHeader, process.env.PAYMONGO_WEBHOOK_SECRET);
  if (!valid) return res.status(400).json({ error: 'Invalid signature' });

  const event = req.body.data;
  const eventId = event.id;
  const eventType = event.attributes.type;

  const dedup = await query(
    `INSERT INTO processed_webhook_events (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,
    [eventId]
  );
  if (dedup.length === 0) return res.status(200).json({ received: true, duplicate: true });

  if (eventType !== 'checkout_session.payment.paid') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const session = event.attributes.data;
  const metadata = session.attributes.metadata || {};
  const schoolId = Number(metadata.school_id);

  if (metadata.kind === 'signup') {
    await fulfilPendingSignup(schoolId, metadata.session_token);
  } else if (metadata.kind === 'renewal') {
    await queryForSchool(
      schoolId,
      `UPDATE users SET registration_paid_until = GREATEST(registration_paid_until, now()) + interval '2 years' WHERE id = $1`,
      [Number(metadata.user_id)]
    );
  } else if (metadata.kind === 'shop') {
    await queryForSchool(
      schoolId,
      `UPDATE shop_orders SET paid = true, paid_at = COALESCE(paid_at, now()) WHERE session_token = $1`,
      [metadata.session_token]
    );
  }

  res.status(200).json({ received: true });
}));

module.exports = router;
