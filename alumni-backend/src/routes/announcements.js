const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { createNotification } = require('./notifications');

const router = express.Router();

// Returns a clean agenda array, or null when the input is malformed. Missing input means no agenda.
function validateAgenda(agenda) {
  if (agenda === undefined || agenda === null) return [];
  if (!Array.isArray(agenda)) return null;
  const items = [];
  for (const item of agenda) {
    if (!item || typeof item.activity !== 'string' || !item.activity.trim()) return null;
    if (item.time !== undefined && typeof item.time !== 'string') return null;
    items.push({ time: (item.time || '').trim(), activity: item.activity.trim() });
  }
  return items;
}

const ANNOUNCEMENT_SELECT = `
  SELECT a.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
         u.role AS poster_role, u.position AS poster_position
  FROM announcements a LEFT JOIN users u ON u.id = a.posted_by`;

router.get('/', asyncHandler(async (req, res) => {
  const rows = await req.db(`${ANNOUNCEMENT_SELECT} ORDER BY a.created_at DESC`);
  res.json({ announcements: rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Announcement not found' });
  const rows = await req.db(`${ANNOUNCEMENT_SELECT} WHERE a.id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Announcement not found' });
  res.json({ announcement: rows[0] });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const agenda = validateAgenda(req.body.agenda);
  if (agenda === null) return res.status(400).json({ error: 'agenda must be a list of { time, activity }' });
  const rows = await req.db(
    `INSERT INTO announcements (school_id, title, body, posted_by, agenda) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [req.school.id, title, body || null, req.user.id, JSON.stringify(agenda)]
  );
  const announcement = rows[0];

  const others = await req.db('SELECT id FROM users WHERE id != $1 AND active = true', [req.user.id]);
  for (const u of others) {
    await createNotification(req.db, {
      userId: u.id,
      type: 'announcement',
      title: 'New announcement',
      body: title,
      link: `/announcements/${announcement.id}`,
    });
  }

  res.status(201).json({ announcement });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM announcements WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
