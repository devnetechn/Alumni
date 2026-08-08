const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/alumni', requireAuth, asyncHandler(async (req, res) => {
  const { search, batch, course, industry, company, location, mentor } = req.query;
  const conditions = ['active = true'];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(full_name ILIKE $${values.length} OR company ILIKE $${values.length} OR position ILIKE $${values.length})`);
  }
  if (batch) {
    values.push(batch);
    conditions.push(`batch_year::text = $${values.length}`);
  }
  if (course) {
    values.push(`%${course}%`);
    conditions.push(`course ILIKE $${values.length}`);
  }
  if (industry) {
    values.push(`%${industry}%`);
    conditions.push(`industry ILIKE $${values.length}`);
  }
  if (company) {
    values.push(`%${company}%`);
    conditions.push(`company ILIKE $${values.length}`);
  }
  if (location) {
    values.push(`%${location}%`);
    conditions.push(`address ILIKE $${values.length}`);
  }
  if (mentor) {
    conditions.push(`mentor_available = true`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await req.db(
    `SELECT id, id AS user_id, email, full_name, batch_year, course, contact, address,
            company, position, industry, bio, profile_pic, mentor_available, nfc_uid, role
     FROM users ${where} ORDER BY full_name NULLS LAST`,
    values
  );
  res.json({ alumni: rows });
}));

module.exports = router;
