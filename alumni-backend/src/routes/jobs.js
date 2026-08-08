const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;
  const conditions = [];
  const values = [];
  if (type) {
    values.push(type);
    conditions.push(`j.job_type = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await req.db(
    `SELECT j.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
            u.role AS poster_role, u.position AS poster_position
     FROM jobs j LEFT JOIN users u ON u.id = j.posted_by
     ${where}
     ORDER BY j.created_at DESC`,
    values
  );
  res.json({ jobs: rows });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { title, company, location, description, job_type, is_referral } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await req.db(
    `INSERT INTO jobs (school_id, title, company, location, description, job_type, is_referral, posted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.school.id, title, company || null, location || null, description || null, job_type || 'job', !!is_referral, req.user.id]
  );
  res.status(201).json({ job: rows[0] });
}));

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Job not found' });
  const job = rows[0];
  if (req.user.role !== 'admin' && req.user.id !== job.posted_by) {
    return res.status(403).json({ error: 'Not allowed to delete this job' });
  }
  await req.db('DELETE FROM jobs WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
