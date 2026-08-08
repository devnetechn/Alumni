const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { emitToUser } = require('../lib/socket');
const { createNotification } = require('./notifications');
const { generateReply } = require('../lib/ai');

const router = express.Router();

async function replyIfBot(db, schoolId, receiverId, senderId, userBody) {
  const [bot] = await db('SELECT id FROM users WHERE is_bot = true LIMIT 1');
  if (!bot || bot.id !== receiverId) return;

  const historyRows = await db(
    `SELECT sender_id, body FROM messages
     WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
     ORDER BY created_at DESC LIMIT 10`,
    [senderId, bot.id]
  );
  const history = historyRows
    .reverse()
    .slice(0, -1)
    .map((m) => ({ role: m.sender_id === bot.id ? 'assistant' : 'user', content: m.body }));

  const reply = await generateReply(history, userBody, db);

  const [replyMessage] = await db(
    `INSERT INTO messages (school_id, sender_id, receiver_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [schoolId, bot.id, senderId, reply]
  );
  emitToUser(senderId, 'message:new', replyMessage);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await req.db(
      `SELECT
         other.id AS other_id, other.full_name AS other_name, other.email AS other_email,
         (SELECT body FROM messages m2
          WHERE (m2.sender_id = $1 AND m2.receiver_id = other.id) OR (m2.sender_id = other.id AND m2.receiver_id = $1)
          ORDER BY m2.created_at DESC LIMIT 1) AS last_body,
         (SELECT COUNT(*) FROM messages m3 WHERE m3.sender_id = other.id AND m3.receiver_id = $1 AND m3.read_at IS NULL)::int AS unread_count,
         (SELECT MAX(m4.created_at) FROM messages m4
          WHERE (m4.sender_id = $1 AND m4.receiver_id = other.id) OR (m4.sender_id = other.id AND m4.receiver_id = $1)) AS last_at
       FROM users other
       WHERE other.id IN (
         SELECT receiver_id FROM messages WHERE sender_id = $1
         UNION
         SELECT sender_id FROM messages WHERE receiver_id = $1
       )
       ORDER BY last_at DESC`,
      [req.user.id]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    const otherRows = await req.db(
      'SELECT id, full_name, email, batch_year, course FROM users WHERE id = $1',
      [otherId]
    );
    if (otherRows.length === 0) return res.status(404).json({ error: 'User not found' });

    const messages = await req.db(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [req.user.id, otherId]
    );

    await req.db(
      `UPDATE messages SET read_at = now() WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL`,
      [otherId, req.user.id]
    );

    res.json({ messages, other: otherRows[0] });
  } catch (err) {
    console.error('Error fetching thread:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { receiver_id, body } = req.body;
    if (!receiver_id || !body) return res.status(400).json({ error: 'receiver_id and body are required' });
    const rows = await req.db(
      `INSERT INTO messages (school_id, sender_id, receiver_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.school.id, req.user.id, receiver_id, body]
    );
    const message = rows[0];
    emitToUser(receiver_id, 'message:new', message);
    await createNotification(req.db, {
      userId: receiver_id,
      type: 'message',
      title: `New message from ${req.user.full_name || req.user.email}`,
      body: body.length > 100 ? body.slice(0, 100) + '...' : body,
      link: `/messages?to=${req.user.id}`,
    });
    res.status(201).json({ message: message });

    replyIfBot(req.db, req.school.id, receiver_id, req.user.id, body).catch((err) => {
      console.error('Error generating bot reply:', err);
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
