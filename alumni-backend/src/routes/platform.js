const express = require('express');
const { pool } = require('../db');
const { hashPassword } = require('../lib/password');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const RESERVED_SLUGS = ['www', 'api', 'admin', 'app', 'platform', 'signup', 'static', 'mail'];
const SLUG_RE = /^[a-z0-9-]+$/;

router.post('/schools', asyncHandler(async (req, res) => {
  const { name, slug, logo, full_name, email, password } = req.body;

  if (!name || !slug || !email || !password) {
    return res.status(400).json({ error: 'name, slug, email, and password are required' });
  }
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return res.status(409).json({ error: 'That slug is reserved' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM schools WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That slug is already taken' });
    }

    const schoolRows = await client.query(
      `INSERT INTO schools (slug, name, logo) VALUES ($1, $2, $3) RETURNING id, slug`,
      [slug, name, logo || null]
    );
    const school = schoolRows.rows[0];

    const password_hash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (school_id, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [school.id, email, password_hash, full_name || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ slug: school.slug });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
