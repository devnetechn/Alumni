const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const isId = (v) => /^\d+$/.test(String(v));

router.get('/', asyncHandler(async (req, res) => {
  const { batch_id } = req.query;
  if (batch_id !== undefined && !isId(batch_id)) return res.json({ photos: [] });
  const rows = await req.db(
    `SELECT g.id, g.batch_id, b.name AS batch_name, g.media, g.caption, g.created_at
     FROM batch_gallery g JOIN batches b ON b.id = g.batch_id
     ${batch_id !== undefined ? 'WHERE g.batch_id = $1' : ''}
     ORDER BY g.created_at DESC, g.id DESC
     LIMIT 24`,
    batch_id !== undefined ? [batch_id] : []
  );
  res.json({ photos: rows });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { batch_id, media, caption } = req.body;
  if (!media || batch_id === undefined || batch_id === null) {
    return res.status(400).json({ error: 'batch_id and media are required' });
  }
  if (!isId(batch_id)) return res.status(404).json({ error: 'Batch not found' });
  const batch = await req.db('SELECT id FROM batches WHERE id = $1', [batch_id]);
  if (batch.length === 0) return res.status(404).json({ error: 'Batch not found' });
  const rows = await req.db(
    `INSERT INTO batch_gallery (school_id, batch_id, media, caption) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, batch_id, media, caption || null]
  );
  res.status(201).json({ photo: rows[0] });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Photo not found' });
  const rows = await req.db('DELETE FROM batch_gallery WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
  res.status(204).end();
}));

module.exports = router;
