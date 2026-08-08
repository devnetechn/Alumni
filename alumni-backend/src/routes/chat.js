const express = require('express');
const ai = require('../lib/ai');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

const MAX_MESSAGES_PER_VISITOR = 10;
const visitorCounts = new Map();

router.post('/chat', asyncHandler(async (req, res) => {
  const { history = [], message, visitorId } = req.body;
  if (!message || !visitorId) {
    return res.status(400).json({ error: 'message and visitorId are required' });
  }

  const key = `${req.school.id}:${visitorId}`;
  const count = visitorCounts.get(key) || 0;
  if (count >= MAX_MESSAGES_PER_VISITOR) {
    return res.status(429).json({ error: "You've reached the question limit for this conversation." });
  }
  visitorCounts.set(key, count + 1);

  const reply = await ai.generateReply(history, message, req.db);
  res.json({ reply, remaining: MAX_MESSAGES_PER_VISITOR - (count + 1) });
}));

module.exports = router;
