const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM officers ORDER BY created_at ASC');
  res.json({ officers: rows });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, position, photo } = req.body;
  if (!name || !position) return res.status(400).json({ error: 'name and position are required' });
  const rows = await req.db(
    `INSERT INTO officers (school_id, name, position, photo) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, name, position, photo || null]
  );
  res.status(201).json({ officer: rows[0] });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM officers WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
