const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { createNotification } = require('./notifications');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT a.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
            u.role AS poster_role, u.position AS poster_position
     FROM announcements a LEFT JOIN users u ON u.id = a.posted_by
     ORDER BY a.created_at DESC`
  );
  res.json({ announcements: rows });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await req.db(
    `INSERT INTO announcements (school_id, title, body, posted_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, title, body || null, req.user.id]
  );
  const announcement = rows[0];

  const others = await req.db('SELECT id FROM users WHERE id != $1 AND active = true', [req.user.id]);
  for (const u of others) {
    await createNotification(req.db, {
      userId: u.id,
      type: 'announcement',
      title: 'New announcement',
      body: title,
      link: '/announcements',
    });
  }

  res.status(201).json({ announcement });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM announcements WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
