const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/users', asyncHandler(async (req, res) => {
  const users = await query(
    `SELECT id, email, role, active, is_batch_leader, full_name, batch_year, course, created_at
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

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  const rows = await query(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const user = rows[0];
  delete user.password_hash;
  res.json({ user });
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
