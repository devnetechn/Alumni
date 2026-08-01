const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await query(
      `SELECT a.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
              u.role AS poster_role, u.position AS poster_position
       FROM announcements a LEFT JOIN users u ON u.id = a.posted_by
       ORDER BY a.created_at DESC`
    );
    res.json({ announcements: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const rows = await query(
      `INSERT INTO announcements (title, body, posted_by) VALUES ($1,$2,$3) RETURNING *`,
      [title, body || null, req.user.id]
    );
    res.status(201).json({ announcement: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
