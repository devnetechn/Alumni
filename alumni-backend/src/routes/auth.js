const express = require('express');
const { hashPassword, comparePassword } = require('../lib/password');
const { signToken } = require('../lib/token');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, full_name, batch_year, course, contact, address, company, position, industry, member_type } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const resolvedMemberType = member_type || 'alumnus';
  if (!['alumnus', 'guest'].includes(resolvedMemberType)) {
    return res.status(400).json({ error: 'member_type must be alumnus or guest' });
  }

  const existing = await req.db('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await hashPassword(password);
  const rows = await req.db(
    `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, course, contact, address, company, position, industry, member_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [req.school.id, email, password_hash, full_name || null, batch_year || null, course || null, contact || null, address || null, company || null, position || null, industry || null, resolvedMemberType]
  );
  const user = rows[0];
  delete user.password_hash;
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
