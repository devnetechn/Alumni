const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const EDITABLE_FIELDS = [
  'full_name', 'batch_year', 'course', 'contact', 'address', 'company',
  'position', 'industry', 'bio', 'profile_pic', 'mentor_available', 'nfc_uid',
  'directory_visible', 'show_location',
];

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [bot] = await req.db('SELECT id, full_name FROM users WHERE is_bot = true LIMIT 1');
  const [membership] = await req.db(
    `SELECT m.id, m.status, m.requested_at, m.decided_at, m.decision_note, b.id AS batch_id, b.name AS batch_name, b.year AS batch_year
     FROM batch_memberships m JOIN batches b ON b.id = m.batch_id WHERE m.user_id = $1`,
    [req.user.id]
  );
  const managed = await req.db('SELECT id, name, year FROM batches WHERE president_id = $1', [req.user.id]);
  res.json({ me: req.user, bot: bot || null, membership: membership || null, managedBatches: managed });
}));

router.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.json({ me: req.user });

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);

  const rows = await req.db(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.user.id]
  );
  const me = rows[0];
  delete me.password_hash;
  res.json({ me });
}));

module.exports = router;
