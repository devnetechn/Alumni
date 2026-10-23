const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const PUBLIC_COLUMNS = `u.id, u.full_name, u.batch_year, u.course, u.profile_pic, u.company, u.position,
  CASE WHEN u.show_location THEN u.address END AS location`;

const VISIBLE = `u.active = true AND u.is_bot = false AND u.directory_visible = true AND u.role <> 'admin'
  AND u.member_type = 'alumnus'
  AND EXISTS (SELECT 1 FROM batch_memberships m WHERE m.user_id = u.id AND m.status = 'approved')`;

router.get('/', asyncHandler(async (req, res) => {
  const { search, year, course } = req.query;
  const values = [];
  const conditions = [VISIBLE];
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`u.full_name ILIKE $${values.length}`);
  }
  if (year && /^\d{4}$/.test(year)) {
    values.push(year);
    conditions.push(`u.batch_year::text = $${values.length}`);
  }
  if (course) {
    values.push(`%${course}%`);
    conditions.push(`u.course ILIKE $${values.length}`);
  }
  const alumni = await req.db(
    `SELECT ${PUBLIC_COLUMNS} FROM users u WHERE ${conditions.join(' AND ')}
     ORDER BY u.full_name NULLS LAST LIMIT 120`,
    values
  );
  const courses = await req.db(
    `SELECT DISTINCT u.course FROM users u WHERE ${VISIBLE} AND u.course IS NOT NULL ORDER BY u.course`
  );
  const years = await req.db(
    `SELECT DISTINCT u.batch_year FROM users u WHERE ${VISIBLE} AND u.batch_year IS NOT NULL ORDER BY u.batch_year DESC`
  );
  res.json({ alumni, courses: courses.map((c) => c.course), years: years.map((y) => y.batch_year) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Profile not found' });
  const rows = await req.db(
    `SELECT ${PUBLIC_COLUMNS}, u.bio, u.industry FROM users u WHERE u.id = $1 AND ${VISIBLE}`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
  res.json({ alumnus: rows[0] });
}));

module.exports = router;
