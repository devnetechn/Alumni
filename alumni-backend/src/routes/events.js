const express = require('express');
const { requireAuth, requireAdmin, requireOfficer } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { createNotification } = require('./notifications');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const events = await req.db('SELECT * FROM events ORDER BY event_date ASC');
  res.json({ events });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM events WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
  res.json({ event: rows[0] });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description, location, event_date } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: 'title and event_date are required' });
  const rows = await req.db(
    `INSERT INTO events (school_id, title, description, location, event_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.school.id, title, description || null, location || null, event_date, req.user.id]
  );
  const event = rows[0];

  const others = await req.db('SELECT id FROM users WHERE active = true');
  for (const u of others) {
    await createNotification(req.db, {
      userId: u.id,
      type: 'event',
      title: 'New event: ' + title,
      body: description || null,
      link: `/events`,
    });
  }

  res.status(201).json({ event });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await req.db('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

router.get('/:id/rsvp', requireAuth, asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const rows = await req.db('SELECT status, user_id FROM event_rsvps WHERE event_id = $1', [eventId]);
  const counts = { going: 0, maybe: 0, not_going: 0 };
  for (const r of rows) counts[r.status] += 1;
  const mine = rows.find((r) => r.user_id === req.user.id);
  res.json({ counts, myStatus: mine ? mine.status : null });
}));

router.post('/:id/rsvp', requireAuth, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['going', 'maybe', 'not_going'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const rows = await req.db(
    `INSERT INTO event_rsvps (school_id, event_id, user_id, status, paid)
     VALUES ($1,$2,$3,$4, true)
     ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [req.school.id, req.params.id, req.user.id, status]
  );
  res.json({ rsvp: rows[0] });
}));

router.get('/:id/registrations', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT r.id AS rsvp_id, r.user_id AS alumni_id, u.full_name, u.email, u.batch_year,
            r.status, r.paid
     FROM event_rsvps r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1
     ORDER BY u.full_name NULLS LAST`,
    [req.params.id]
  );
  res.json({ registrations: rows });
}));

router.patch('/:id/registrations/:alumniId', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { paid } = req.body;
  const rows = await req.db(
    `UPDATE event_rsvps SET paid = $1 WHERE event_id = $2 AND user_id = $3 RETURNING *`,
    [!!paid, req.params.id, req.params.alumniId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Registration not found' });
  res.json({ registration: rows[0] });
}));

router.get('/:id/checkin', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT c.id, u.full_name, u.batch_year, u.course, c.checked_in_at
     FROM event_checkins c JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at ASC`,
    [req.params.id]
  );
  res.json({ attendance: rows });
}));

function csvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function resolveAlumniFromCode(db, code) {
  const match = /^ALUMNI:(\d+)$/.exec(code || '');
  if (match) {
    const rows = await db('SELECT * FROM users WHERE id = $1', [match[1]]);
    return rows[0] || null;
  }
  const rows = await db('SELECT * FROM users WHERE nfc_uid = $1', [code]);
  return rows[0] || null;
}

router.post('/:id/checkin', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const alumni = await resolveAlumniFromCode(req.db, req.body.code);
  if (!alumni) return res.status(404).json({ error: 'Alumni not found for this code' });

  const rsvpRows = await req.db(
    'SELECT * FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
    [eventId, alumni.id]
  );
  const rsvp = rsvpRows[0];
  if (!rsvp || rsvp.status !== 'going' || !rsvp.paid) {
    return res.status(403).json({ error: 'Alumni must RSVP going and be marked paid before check-in' });
  }

  const rows = await req.db(
    `INSERT INTO event_checkins (school_id, event_id, user_id, checked_in_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (event_id, user_id) DO UPDATE SET checked_in_at = now()
     RETURNING *`,
    [req.school.id, eventId, alumni.id, req.user.id]
  );
  res.status(201).json({
    checkin: rows[0],
    alumni: {
      id: alumni.id,
      full_name: alumni.full_name,
      profile_pic: alumni.profile_pic,
      batch_year: alumni.batch_year,
      course: alumni.course,
    },
  });
}));

router.get('/:id/export', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT u.full_name, u.batch_year, u.course, c.checked_in_at
     FROM event_checkins c JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at ASC`,
    [req.params.id]
  );
  const header = `${csvField('Name')},${csvField('Batch')},${csvField('Course')},${csvField('Checked In At')}\n`;
  const body = rows
    .map((r) => `${csvField(r.full_name)},${csvField(r.batch_year || '')},${csvField(r.course || '')},${csvField(r.checked_in_at.toISOString())}`)
    .join('\n');
  res.set('Content-Type', 'text/csv').send(header + body);
}));

module.exports = router;
