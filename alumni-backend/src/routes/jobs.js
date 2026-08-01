const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const conditions = [];
    const values = [];
    if (type) {
      values.push(type);
      conditions.push(`j.job_type = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT j.*, u.full_name AS poster_name, u.email AS poster_email, u.profile_pic AS poster_pic,
              u.role AS poster_role, u.position AS poster_position
       FROM jobs j LEFT JOIN users u ON u.id = j.posted_by
       ${where}
       ORDER BY j.created_at DESC`,
      values
    );
    res.json({ jobs: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, company, location, description, job_type, is_referral } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const rows = await query(
      `INSERT INTO jobs (title, company, location, description, job_type, is_referral, posted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, company || null, location || null, description || null, job_type || 'job', !!is_referral, req.user.id]
    );
    res.status(201).json({ job: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== job.posted_by) {
      return res.status(403).json({ error: 'Not allowed to delete this job' });
    }
    await query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
