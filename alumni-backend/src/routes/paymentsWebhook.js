const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { query, queryForSchool } = require('../db');
const paymongo = require('../lib/paymongo');

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
    await queryForSchool(
      schoolId,
      `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, contact, address, member_type, registration_paid_until, paymongo_checkout_session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() + interval '2 years', $9)`,
      [
        schoolId,
        metadata.email,
        metadata.password_hash,
        metadata.full_name || null,
        metadata.batch_year ? Number(metadata.batch_year) : null,
        metadata.contact || null,
        metadata.address || null,
        metadata.member_type,
        session.id,
      ]
    );
  } else if (metadata.kind === 'renewal') {
    await queryForSchool(
      schoolId,
      `UPDATE users SET registration_paid_until = GREATEST(registration_paid_until, now()) + interval '2 years' WHERE id = $1`,
      [Number(metadata.user_id)]
    );
  }

  res.status(200).json({ received: true });
}));

module.exports = router;
