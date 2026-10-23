const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { query, queryForSchool } = require('../db');
const paymongo = require('../lib/paymongo');
const { notifyRequestSubmitted } = require('../lib/batchAccess');
const { createNotification } = require('./notifications');

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
    const pending = await queryForSchool(
      schoolId,
      `SELECT * FROM pending_signups WHERE session_token = $1`,
      [metadata.session_token]
    );
    if (pending.length > 0) {
      const signup = pending[0];
      const [created] = await queryForSchool(
        schoolId,
        `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, contact, address, member_type, profile_pic, registration_paid_until, paymongo_checkout_session_id, course, requested_batch_year)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + interval '2 years', $10, $11, $12) RETURNING id`,
        [
          schoolId,
          signup.email,
          signup.password_hash,
          signup.full_name,
          signup.batch_year,
          signup.contact,
          signup.address,
          signup.member_type,
          signup.profile_pic,
          metadata.session_token,
          signup.course,
          signup.requested_batch_year,
        ]
      );
      if (!signup.batch_id && signup.requested_batch_year) {
        const admins = await queryForSchool(schoolId, "SELECT id FROM users WHERE role = 'admin' AND active = true");
        for (const a of admins) {
          await createNotification((t, p) => queryForSchool(schoolId, t, p), { userId: a.id, type: 'membership', title: `Batch ${signup.requested_batch_year} requested`, body: `${signup.full_name || signup.email} registered for a batch that is not listed yet.`, link: '/admin/batches' });
        }
      }
      if (signup.batch_id) {
        const [batch] = await queryForSchool(schoolId, 'SELECT * FROM batches WHERE id = $1', [signup.batch_id]);
        if (batch) {
          await queryForSchool(schoolId, 'INSERT INTO batch_memberships (school_id, batch_id, user_id) VALUES ($1,$2,$3)', [schoolId, batch.id, created.id]);
          await notifyRequestSubmitted((t, p) => queryForSchool(schoolId, t, p), batch, { id: created.id, full_name: signup.full_name, email: signup.email });
        }
      }
      await queryForSchool(schoolId, `DELETE FROM pending_signups WHERE session_token = $1`, [metadata.session_token]);
    }
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
