const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM partners ORDER BY created_at DESC');
  res.json({ partners: rows });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, logo, website_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await req.db(
    `INSERT INTO partners (school_id, name, logo, website_url) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, name, logo || null, website_url || null]
  );
  res.status(201).json({ partner: rows[0] });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM partners WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
