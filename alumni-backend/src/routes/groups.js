const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT g.*,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS member_count,
            EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $1) AS is_member
     FROM groups g
     ORDER BY g.created_at DESC`,
    [req.user.id]
  );
  res.json({ groups: rows });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const groupRows = await req.db('SELECT * FROM groups WHERE id = $1', [req.params.id]);
  if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });

  const members = await req.db(
    `SELECT u.id, u.full_name, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1`,
    [req.params.id]
  );
  const isMember = members.some((m) => m.id === req.user.id);
  res.json({ group: groupRows[0], members, isMember });
}));

router.get('/:id/posts', requireAuth, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT p.*, u.full_name AS author_name, u.email AS author_email
     FROM group_posts p JOIN users u ON u.id = p.author_id
     WHERE p.group_id = $1
     ORDER BY p.created_at ASC`,
    [req.params.id]
  );
  res.json({ posts: rows });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { name, description, kind } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await req.db(
    `INSERT INTO groups (school_id, name, description, kind, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.school.id, name, description || null, kind || 'interest', req.user.id]
  );
  const group = rows[0];
  await req.db(
    `INSERT INTO group_members (school_id, group_id, user_id) VALUES ($1,$2,$3)`,
    [req.school.id, group.id, req.user.id]
  );
  res.status(201).json({ group });
}));

router.post('/:id/join', requireAuth, asyncHandler(async (req, res) => {
  await req.db(
    `INSERT INTO group_members (school_id, group_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [req.school.id, req.params.id, req.user.id]
  );
  res.status(204).end();
}));

router.delete('/:id/join', requireAuth, asyncHandler(async (req, res) => {
  await req.db(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  res.status(204).end();
}));

router.post('/:id/posts', requireAuth, asyncHandler(async (req, res) => {
  const membership = await req.db(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'Must be a group member to post' });

  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });
  const rows = await req.db(
    `INSERT INTO group_posts (school_id, group_id, author_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.school.id, req.params.id, req.user.id, body]
  );
  res.status(201).json({ post: rows[0] });
}));

module.exports = router;
