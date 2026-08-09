const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { requireAuth, requireOfficer } = require('../middleware/auth');

const router = express.Router();

router.post('/:id/photos', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const { media, media_type } = req.body;
  if (!media || !['image', 'video'].includes(media_type)) {
    return res.status(400).json({ error: 'media and a valid media_type (image or video) are required' });
  }
  const rows = await req.db(
    `INSERT INTO event_photos (school_id, event_id, media, media_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.school.id, req.params.id, media, media_type, req.user.id]
  );
  res.status(201).json({ photo: rows[0] });
}));

router.get('/:id/photos', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT * FROM event_photos WHERE event_id = $1 ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json({ photos: rows });
}));

router.delete('/:id/photos/:photoId', requireAuth, requireOfficer, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `DELETE FROM event_photos WHERE id = $1 AND event_id = $2 RETURNING id`,
    [req.params.photoId, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
  res.status(204).end();
}));

router.get('/highlights', asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT ep.id, ep.media, ep.media_type, ep.created_at, e.title AS event_title, e.event_date
     FROM event_photos ep
     JOIN events e ON e.id = ep.event_id
     WHERE e.event_date < now()
     ORDER BY ep.created_at DESC
     LIMIT 12`
  );
  res.json({ highlights: rows });
}));

module.exports = router;
