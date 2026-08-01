const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const events = await query('SELECT * FROM events ORDER BY event_date ASC');
    res.json({ events });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, location, event_date } = req.body;
    if (!title || !event_date) return res.status(400).json({ error: 'title and event_date are required' });
    const rows = await query(
      `INSERT INTO events (title, description, location, event_date, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, description || null, location || null, event_date, req.user.id]
    );
    res.status(201).json({ event: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/rsvp', requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;
    const rows = await query('SELECT status, user_id FROM event_rsvps WHERE event_id = $1', [eventId]);
    const counts = { going: 0, maybe: 0, not_going: 0 };
    for (const r of rows) counts[r.status] += 1;
    const mine = rows.find((r) => r.user_id === req.user.id);
    res.json({ counts, myStatus: mine ? mine.status : null });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/rsvp', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['going', 'maybe', 'not_going'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const rows = await query(
      `INSERT INTO event_rsvps (event_id, user_id, status)
       VALUES ($1,$2,$3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [req.params.id, req.user.id, status]
    );
    res.json({ rsvp: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
