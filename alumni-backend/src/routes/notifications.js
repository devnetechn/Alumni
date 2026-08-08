const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { emitToUser } = require('../lib/socket');

const router = express.Router();

router.get('/notifications', requireAuth, asyncHandler(async (req, res) => {
  const notifications = await req.db(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const unread = notifications.filter((n) => !n.read_at).length;
  res.json({ notifications, unread });
}));

router.patch('/notifications', requireAuth, asyncHandler(async (req, res) => {
  await req.db('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.status(204).end();
}));

async function createNotification(db, { userId, type, title, body, link }) {
  const rows = await db(
    `INSERT INTO notifications (user_id, type, title, body, link, school_id)
     SELECT $1,$2,$3,$4,$5, school_id FROM users WHERE id = $1
     RETURNING *`,
    [userId, type, title, body || null, link || null]
  );
  const notification = rows[0];
  emitToUser(userId, 'notification:new', notification);
  return notification;
}

module.exports = router;
module.exports.createNotification = createNotification;
