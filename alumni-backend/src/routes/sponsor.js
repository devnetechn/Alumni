const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const EMAIL_RE = /^\S+@\S+\.\S+$/;

router.post('/inquiries', asyncHandler(async (req, res) => {
  const { name, email, organization, message } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!email || !EMAIL_RE.test(String(email).trim())) return res.status(400).json({ error: 'a valid email is required' });
  if (String(name).length > 200 || String(email).length > 200 || String(organization || '').length > 200 || String(message || '').length > 5000) {
    return res.status(400).json({ error: 'One of the fields is too long' });
  }
  await req.db(
    `INSERT INTO sponsor_inquiries (school_id, name, email, organization, message) VALUES ($1,$2,$3,$4,$5)`,
    [req.school.id, String(name).trim(), String(email).trim(), String(organization || '').trim() || null, String(message || '').trim() || null]
  );
  res.status(201).json({ ok: true });
}));

router.get('/inquiries', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM sponsor_inquiries ORDER BY created_at DESC, id DESC');
  res.json({ inquiries: rows });
}));

router.delete('/inquiries/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Inquiry not found' });
  const rows = await req.db('DELETE FROM sponsor_inquiries WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });
  res.status(204).end();
}));

module.exports = router;
