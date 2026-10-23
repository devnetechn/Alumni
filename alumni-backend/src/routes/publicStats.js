const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const [row] = await req.db(
    `SELECT
       (SELECT COUNT(*) FROM batches)::int AS batches,
       (SELECT COUNT(DISTINCT m.user_id) FROM batch_memberships m WHERE m.status = 'approved')::int AS alumni,
       (SELECT COUNT(*) FROM events WHERE batch_id IS NULL AND event_date >= now())::int AS upcoming_events,
       (SELECT COUNT(DISTINCT m.batch_id) FROM batch_memberships m WHERE m.status = 'approved')::int AS communities`
  );
  res.json(row);
}));

module.exports = router;
