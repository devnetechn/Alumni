const express = require('express');
const { query } = require('../db');
const { hashPassword, comparePassword } = require('../lib/password');
const { signToken } = require('../lib/token');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, full_name, batch_year, course, contact, company, position, industry } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await hashPassword(password);
    const rows = await query(
      `INSERT INTO users (email, password_hash, full_name, batch_year, course, contact, company, position, industry)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [email, password_hash, full_name || null, batch_year || null, course || null, contact || null, company || null, position || null, industry || null]
    );
    const user = rows[0];
    delete user.password_hash;
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const rows = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    delete user.password_hash;
    res.json({ token: signToken(user), user });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
