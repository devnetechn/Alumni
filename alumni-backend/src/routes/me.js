const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const EDITABLE_FIELDS = [
  'full_name', 'batch_year', 'course', 'contact', 'address', 'company',
  'position', 'industry', 'bio', 'profile_pic', 'mentor_available', 'nfc_uid',
];

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [bot] = await query('SELECT id, full_name FROM users WHERE is_bot = true LIMIT 1');
  res.json({ me: req.user, bot: bot || null });
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

  const rows = await query(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.user.id]
  );
  const me = rows[0];
  delete me.password_hash;
  res.json({ me });
}));

module.exports = router;
