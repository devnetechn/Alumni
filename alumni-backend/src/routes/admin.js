const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { audit } = require('../lib/batchAccess');
const { query } = require('../db');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.patch('/school', asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ['registration_open', 'registration_fee']) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  if ('registration_fee' in updates && !(Number.isInteger(updates.registration_fee) && updates.registration_fee >= 0)) {
    return res.status(400).json({ error: 'registration_fee must be a whole number of centavos' });
  }

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  // The schools table has no tenant RLS policy, so a restricted app role can
  // silently update zero rows (e.g. when the host auto-enables RLS). Use the
  // owner connection, as routes/school.js does, and fail loudly on no match.
  const rows = await query(
    `UPDATE schools SET ${setClause} WHERE id = $${columns.length + 1} RETURNING id, slug, name, registration_open, registration_fee`,
    [...values, req.school.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'School not found' });
  res.json({ school: rows[0] });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await req.db(
    `SELECT id, email, role, active, is_batch_leader, member_type, full_name, batch_year, course, created_at
     FROM users ORDER BY created_at DESC`
  );
  res.json({ users });
}));

router.put('/users/:id', asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ['role', 'active', 'is_batch_leader']) {
    if (field in req.body) updates[field] = req.body[field];
  }
  const columns = Object.keys(updates);
  if (columns.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  if (updates.is_batch_leader === true) {
    const targetRows = await req.db('SELECT member_type FROM users WHERE id = $1', [req.params.id]);
    if (targetRows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (targetRows[0].member_type === 'guest') {
      return res.status(400).json({ error: 'Guests cannot be batch leaders' });
    }
  }

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  const rows = await req.db(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const user = rows[0];
  delete user.password_hash;
  await audit(req, 'user.update', 'user', user.id, updates);
  res.json({ user });
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  await req.db('DELETE FROM users WHERE id = $1', [req.params.id]);
  await audit(req, 'user.delete', 'user', Number(req.params.id), null);
  res.status(204).end();
}));

module.exports = router;
