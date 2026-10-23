const express = require('express');
const { hashPassword, comparePassword } = require('../lib/password');
const { signToken } = require('../lib/token');
const { asyncHandler } = require('../lib/asyncHandler');
const { notifyRequestSubmitted } = require('../lib/batchAccess');
const { createNotification } = require('./notifications');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, course, contact, address, company, position, industry, member_type, batch_id, requested_batch_year, profile_pic } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (profile_pic && !/^data:image\/(png|jpe?g|webp);base64,/.test(profile_pic)) {
    return res.status(400).json({ error: 'Profile photo must be an image' });
  }

  const resolvedMemberType = member_type || 'alumnus';
  if (!['alumnus', 'guest'].includes(resolvedMemberType)) {
    return res.status(400).json({ error: 'member_type must be alumnus or guest' });
  }

  const existing = await req.db('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  let batch = null;
  if (batch_id) {
    batch = (await req.db('SELECT * FROM batches WHERE id = $1', [batch_id]))[0];
    if (!batch) return res.status(400).json({ error: 'The selected batch does not exist' });
  } else if (resolvedMemberType === 'alumnus' && !requested_batch_year) {
    const [{ c }] = await req.db('SELECT COUNT(*)::int AS c FROM batches');
    if (c > 0) return res.status(400).json({ error: 'Select your graduation batch' });
  }
  const requestedYear = !batch && requested_batch_year ? parseInt(requested_batch_year, 10) : null;
  if (requested_batch_year && !batch && !(requestedYear >= 1900 && requestedYear <= 2100)) {
    return res.status(400).json({ error: 'Enter a valid graduation year' });
  }

  const password_hash = await hashPassword(password);
  const rows = await req.db(
    `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, course, contact, address, company, position, industry, member_type, profile_pic, requested_batch_year)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [req.school.id, email, password_hash, full_name || null, batch ? batch.year : (batch_year || requestedYear || null), course || null, contact || null, address || null, company || null, position || null, industry || null, resolvedMemberType, profile_pic || null, requestedYear]
  );
  const user = rows[0];
  delete user.password_hash;
  if (batch) {
    await req.db('INSERT INTO batch_memberships (school_id, batch_id, user_id) VALUES ($1,$2,$3)', [req.school.id, batch.id, user.id]);
    await notifyRequestSubmitted(req.db, batch, user);
  } else if (requestedYear) {
    const admins = await req.db("SELECT id FROM users WHERE role = 'admin' AND active = true");
    for (const a of admins) {
      await createNotification(req.db, { userId: a.id, type: 'membership', title: `Batch ${requestedYear} requested`, body: `${user.full_name || user.email} registered for a batch that is not listed yet.`, link: '/admin/batches' });
    }
  }
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const rows = await req.db('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

  const user = rows[0];
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  if (!user.active) return res.status(403).json({ error: 'Account is deactivated' });

  delete user.password_hash;
  res.json({ token: signToken(user), user });
}));

module.exports = router;
