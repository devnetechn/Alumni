const express = require('express');
const { platformQuery } = require('../db');
const { hashPassword, comparePassword } = require('../lib/password');
const { signPlatformToken } = require('../lib/token');
const { asyncHandler } = require('../lib/asyncHandler');
const { requirePlatformAdmin } = require('../middleware/platformAuth');

const router = express.Router();

router.post('/signup', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const existing = await platformQuery('SELECT id FROM platform_admins');
  if (existing.length > 0) {
    return res.status(403).json({ error: 'Platform admin already set up' });
  }

  const password_hash = await hashPassword(password);
  const rows = await platformQuery(
    'INSERT INTO platform_admins (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, password_hash]
  );
  const admin = rows[0];
  res.status(201).json({ token: signPlatformToken(admin) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const rows = await platformQuery('SELECT * FROM platform_admins WHERE email = $1', [email]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

  const admin = rows[0];
  const ok = await comparePassword(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ token: signPlatformToken(admin) });
}));

router.get('/schools', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const schools = await platformQuery(`
    SELECT s.id, s.slug, s.name, s.active, s.plan, s.trial_ends_at, s.created_at,
      (SELECT COUNT(*)::int FROM users u WHERE u.school_id = s.id AND u.is_bot = false) AS alumni_count,
      (SELECT COUNT(*)::int FROM events e WHERE e.school_id = s.id) AS event_count
    FROM schools s ORDER BY s.created_at DESC
  `);
  res.json({ schools });
}));

router.patch('/schools/:id', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { active, plan, extendTrialDays } = req.body;

  if (typeof active === 'boolean') {
    await platformQuery('UPDATE schools SET active = $1 WHERE id = $2', [active, id]);
  } else if (plan === 'active') {
    await platformQuery(`UPDATE schools SET plan = 'active' WHERE id = $1`, [id]);
  } else if (typeof extendTrialDays === 'number') {
    await platformQuery(
      `UPDATE schools SET trial_ends_at = GREATEST(trial_ends_at, now()) + ($1 || ' days')::interval WHERE id = $2`,
      [extendTrialDays, id]
    );
  } else {
    return res.status(400).json({ error: 'Provide active, plan, or extendTrialDays' });
  }

  const rows = await platformQuery(
    'SELECT id, slug, name, active, plan, trial_ends_at FROM schools WHERE id = $1',
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'School not found' });
  res.json({ school: rows[0] });
}));

router.delete('/schools/:id', requirePlatformAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { confirmSlug } = req.body;

  const rows = await platformQuery('SELECT slug FROM schools WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'School not found' });

  if (rows[0].slug !== confirmSlug) {
    return res.status(400).json({ error: 'Slug confirmation does not match' });
  }

  await platformQuery('DELETE FROM schools WHERE id = $1', [id]);
  res.status(204).end();
}));

module.exports = router;
