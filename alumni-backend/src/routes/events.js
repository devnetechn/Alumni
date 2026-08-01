const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin, requireOfficer } = require('../middleware/auth');

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

router.get('/:id/registrations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.id AS rsvp_id, r.user_id AS alumni_id, u.full_name, u.email, u.batch_year,
              r.status, r.paid
       FROM event_rsvps r JOIN users u ON u.id = r.user_id
       WHERE r.event_id = $1
       ORDER BY u.full_name NULLS LAST`,
      [req.params.id]
    );
    res.json({ registrations: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/registrations/:alumniId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { paid } = req.body;
    const rows = await query(
      `UPDATE event_rsvps SET paid = $1 WHERE event_id = $2 AND user_id = $3 RETURNING *`,
      [!!paid, req.params.id, req.params.alumniId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Registration not found' });
    res.json({ registration: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/checkin', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT c.id, u.full_name, u.batch_year, u.course, c.checked_in_at
       FROM event_checkins c JOIN users u ON u.id = c.user_id
       WHERE c.event_id = $1
       ORDER BY c.checked_in_at ASC`,
      [req.params.id]
    );
    res.json({ attendance: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function resolveAlumniFromCode(code) {
  try {
    const match = /^ALUMNI:(\d+)$/.exec(code || '');
    if (match) {
      const rows = await query('SELECT * FROM users WHERE id = $1', [match[1]]);
      return rows[0] || null;
    }
    const rows = await query('SELECT * FROM users WHERE nfc_uid = $1', [code]);
    return rows[0] || null;
  } catch (err) {
    throw err;
  }
}

router.post('/:id/checkin', requireAuth, requireOfficer, async (req, res) => {
  try {
    const eventId = req.params.id;
    const alumni = await resolveAlumniFromCode(req.body.code);
    if (!alumni) return res.status(404).json({ error: 'Alumni not found for this code' });

    const rsvpRows = await query(
      'SELECT * FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
      [eventId, alumni.id]
    );
    const rsvp = rsvpRows[0];
    if (!rsvp || rsvp.status !== 'going' || !rsvp.paid) {
      return res.status(403).json({ error: 'Alumni must RSVP going and be marked paid before check-in' });
    }

    const rows = await query(
      `INSERT INTO event_checkins (event_id, user_id, checked_in_by)
       VALUES ($1,$2,$3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET checked_in_at = now()
       RETURNING *`,
      [eventId, alumni.id, req.user.id]
    );
    res.status(201).json({ checkin: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/export', requireAuth, requireOfficer, async (req, res) => {
  try {
    const rows = await query(
      `SELECT u.full_name, u.batch_year, u.course, c.checked_in_at
       FROM event_checkins c JOIN users u ON u.id = c.user_id
       WHERE c.event_id = $1
       ORDER BY c.checked_in_at ASC`,
      [req.params.id]
    );
    const header = 'Name,Batch,Course,Checked In At\n';
    const body = rows
      .map((r) => `${r.full_name},${r.batch_year || ''},${r.course || ''},${r.checked_in_at.toISOString()}`)
      .join('\n');
    res.set('Content-Type', 'text/csv').send(header + body);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
