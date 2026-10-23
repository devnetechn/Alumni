const express = require('express');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const { createNotification } = require('./notifications');
const { withBatch, requireBatchMember, requireBatchManager, audit, notifyRequestSubmitted } = require('../lib/batchAccess');

const { hashPassword } = require('../lib/password');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_IMAGE_CHARS = 3 * 1024 * 1024;

function validImage(value) {
  return typeof value === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(value) && value.length <= MAX_IMAGE_CHARS;
}

const BATCH_SELECT = `
  SELECT b.id, b.year, b.name, b.description, b.cover_image, b.president_id, b.created_at,
         p.full_name AS president_name, p.profile_pic AS president_pic, p.position AS president_position,
         (SELECT COUNT(*) FROM batch_memberships m WHERE m.batch_id = b.id AND m.status = 'approved')::int AS member_count
  FROM batches b LEFT JOIN users p ON p.id = b.president_id`;

router.get('/', asyncHandler(async (req, res) => {
  const batches = await req.db(`${BATCH_SELECT} ORDER BY b.year DESC`);
  res.json({ batches });
}));

router.get('/admin/requests', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
  const rows = await req.db(
    `SELECT m.id, m.status, m.requested_at, m.decided_at, m.decision_note, b.id AS batch_id, b.year AS batch_year,
            u.id AS user_id, u.full_name, u.email, d.full_name AS decided_by_name
     FROM batch_memberships m
     JOIN batches b ON b.id = m.batch_id
     JOIN users u ON u.id = m.user_id
     LEFT JOIN users d ON d.id = m.decided_by
     WHERE ($1::text IS NULL OR m.status = $1)
     ORDER BY m.requested_at DESC LIMIT 200`,
    [status]
  );
  res.json({ requests: rows });
}));

router.get('/admin/unlisted', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT requested_batch_year AS year, COUNT(*)::int AS applicants
     FROM users WHERE requested_batch_year IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM batches b WHERE b.year = users.requested_batch_year)
     GROUP BY requested_batch_year ORDER BY requested_batch_year DESC`
  );
  res.json({ unlisted: rows });
}));

router.get('/admin/audit', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const rows = await req.db(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.meta, a.created_at, u.full_name AS actor_name
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC LIMIT 200`
  );
  res.json({ logs: rows });
}));

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const year = parseInt(req.body.year, 10);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return res.status(400).json({ error: 'A valid graduation year is required' });
  }
  const name = (req.body.name || `Batch ${year}`).trim();
  const existing = await req.db('SELECT id FROM batches WHERE year = $1', [year]);
  if (existing.length > 0) return res.status(409).json({ error: `Batch ${year} already exists` });
  const rows = await req.db(
    'INSERT INTO batches (school_id, year, name, description) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.school.id, year, name, req.body.description || null]
  );
  await audit(req, 'batch.create', 'batch', rows[0].id, { year });
  res.status(201).json({ batch: rows[0] });
}));

router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Batch not found' });
  const rows = await req.db(`${BATCH_SELECT} WHERE b.id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Batch not found' });
  const batch = rows[0];
  let membership = null;
  let canManage = false;
  if (req.user) {
    const m = await req.db('SELECT id, status, requested_at, decided_at FROM batch_memberships WHERE batch_id = $1 AND user_id = $2', [batch.id, req.user.id]);
    membership = m[0] || null;
    canManage = req.user.role === 'admin' || batch.president_id === req.user.id;
  }
  const isMember = canManage || (membership && membership.status === 'approved');
  res.json({ batch, membership, canManage, isMember });
}));

router.patch('/:id', requireAuth, withBatch, requireBatchManager, asyncHandler(async (req, res) => {
  const updates = {};
  if ('description' in req.body) updates.description = req.body.description || null;
  if ('cover_image' in req.body) {
    if (req.body.cover_image && !validImage(req.body.cover_image)) return res.status(400).json({ error: 'Cover must be an image under 3MB' });
    updates.cover_image = req.body.cover_image || null;
  }
  if ('name' in req.body && req.user.role === 'admin' && req.body.name) updates.name = req.body.name.trim();
  const cols = Object.keys(updates);
  if (cols.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  const rows = await req.db(
    `UPDATE batches SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`,
    [...cols.map((c) => updates[c]), req.batch.id]
  );
  await audit(req, 'batch.update', 'batch', req.batch.id, { fields: cols });
  res.json({ batch: rows[0] });
}));

// Approves the user into the batch and makes them its president.
async function setPresident(req, userId) {
  await req.db(
    `INSERT INTO batch_memberships (school_id, batch_id, user_id, status, decided_at, decided_by)
     VALUES ($1,$2,$3,'approved', now(), $4)
     ON CONFLICT (user_id) DO UPDATE SET batch_id = EXCLUDED.batch_id, status = 'approved', decided_at = now(), decided_by = $4`,
    [req.school.id, req.batch.id, userId, req.user.id]
  );
  await req.db('UPDATE users SET batch_year = $1 WHERE id = $2', [req.batch.year, userId]);
  const rows = await req.db('UPDATE batches SET president_id = $1 WHERE id = $2 RETURNING *', [userId, req.batch.id]);
  await audit(req, 'batch.assign_president', 'batch', req.batch.id, { president_id: userId });
  await createNotification(req.db, {
    userId, type: 'membership', title: `You are now president of ${req.batch.name}`,
    body: 'You can review membership requests from your batch dashboard.', link: '/president',
  });
  return rows[0];
}

router.put('/:id/president', requireAuth, requireAdmin, withBatch, asyncHandler(async (req, res) => {
  const userId = parseInt(req.body.user_id, 10);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'user_id is required' });
  const users = await req.db('SELECT id, full_name FROM users WHERE id = $1 AND is_bot = false AND active = true', [userId]);
  if (users.length === 0) return res.status(404).json({ error: 'User not found' });

  const existing = await req.db('SELECT * FROM batch_memberships WHERE user_id = $1', [userId]);
  if (existing.length > 0 && existing[0].batch_id !== req.batch.id && existing[0].status === 'approved') {
    return res.status(409).json({ error: 'That user is an approved member of a different batch' });
  }
  res.json({ batch: await setPresident(req, userId) });
}));

// Super admin creates the president's login directly. No registration payment
// is involved: registration_paid_until stays NULL, so the account never expires.
router.post('/:id/president-account', requireAuth, requireAdmin, withBatch, asyncHandler(async (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'Full name is required' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = await req.db('SELECT id FROM users WHERE email = $1', [email.trim()]);
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const rows = await req.db(
    `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, member_type)
     VALUES ($1,$2,$3,$4,$5,'alumnus') RETURNING id, email, full_name`,
    [req.school.id, email.trim(), await hashPassword(password), full_name.trim(), req.batch.year]
  );
  const batch = await setPresident(req, rows[0].id);
  await audit(req, 'batch.create_president_account', 'user', rows[0].id, { batch_id: req.batch.id });
  res.status(201).json({ batch, user: rows[0] });
}));

router.post('/:id/join', requireAuth, withBatch, asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Administrators do not need a membership' });
  const existing = req.membership
    ? [req.membership]
    : await req.db('SELECT * FROM batch_memberships WHERE user_id = $1', [req.user.id]);
  if (existing.length > 0 && existing[0].status !== 'rejected') {
    return res.status(409).json({ error: 'You already have a membership request on file' });
  }
  let row;
  if (existing.length > 0) {
    [row] = await req.db(
      `UPDATE batch_memberships SET batch_id = $1, status = 'pending', requested_at = now(), decided_at = NULL, decided_by = NULL, decision_note = NULL
       WHERE user_id = $2 AND status = 'rejected' RETURNING *`,
      [req.batch.id, req.user.id]
    );
  } else {
    [row] = await req.db(
      `INSERT INTO batch_memberships (school_id, batch_id, user_id) VALUES ($1,$2,$3) RETURNING *`,
      [req.school.id, req.batch.id, req.user.id]
    );
  }
  await notifyRequestSubmitted(req.db, req.batch, req.user);
  res.status(201).json({ membership: row });
}));


router.get('/:id/requests', requireAuth, withBatch, requireBatchManager, asyncHandler(async (req, res) => {
  const filter = req.query.status === 'processed' ? `m.status <> 'pending'` : `m.status = 'pending'`;
  const rows = await req.db(
    `SELECT m.id, m.status, m.requested_at, m.decided_at, m.decision_note,
            u.id AS user_id, u.full_name, u.email, u.course, u.batch_year AS claimed_year, u.profile_pic,
            d.full_name AS decided_by_name
     FROM batch_memberships m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN users d ON d.id = m.decided_by
     WHERE m.batch_id = $1 AND ${filter}
     ORDER BY m.requested_at DESC`,
    [req.batch.id]
  );
  res.json({ requests: rows, batchYear: req.batch.year });
}));

router.post('/:id/requests/:requestId/decision', requireAuth, withBatch, requireBatchManager, asyncHandler(async (req, res) => {
  const { decision, note } = req.body;
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved or rejected' });
  if (!/^\d+$/.test(req.params.requestId)) return res.status(404).json({ error: 'Request not found' });

  const rows = await req.db(
    `UPDATE batch_memberships SET status = $1, decided_at = now(), decided_by = $2, decision_note = $3
     WHERE id = $4 AND batch_id = $5 AND status = 'pending' RETURNING *`,
    [decision, req.user.id, note || null, req.params.requestId, req.batch.id]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'Request not found or already processed' });
  const m = rows[0];
  if (decision === 'approved') await req.db('UPDATE users SET batch_year = $1 WHERE id = $2', [req.batch.year, m.user_id]);

  await audit(req, `membership.${decision}`, 'batch_membership', m.id, { batch_id: req.batch.id, user_id: m.user_id });
  await createNotification(req.db, {
    userId: m.user_id, type: 'membership',
    title: decision === 'approved' ? `Welcome to ${req.batch.name}` : 'Membership request declined',
    body: decision === 'approved'
      ? 'Your request was approved. The private batch community is now open to you.'
      : (note ? `Your request was not approved: ${note}` : 'Your request was not approved by the batch president.'),
    link: decision === 'approved' ? `/batches/${req.batch.id}/community` : '/membership',
  });
  res.json({ membership: m });
}));

router.get('/:id/members', requireAuth, withBatch, requireBatchMember, asyncHandler(async (req, res) => {
  const search = req.query.search ? `%${req.query.search}%` : null;
  const members = await req.db(
    `SELECT u.id, u.full_name, u.profile_pic, u.course, u.company, u.position, m.decided_at AS joined_at,
            (u.id = $1) AS is_president
     FROM batch_memberships m JOIN users u ON u.id = m.user_id
     WHERE m.batch_id = $2 AND m.status = 'approved' AND ($3::text IS NULL OR u.full_name ILIKE $3)
     ORDER BY is_president DESC, u.full_name NULLS LAST`,
    [req.batch.president_id || 0, req.batch.id, search]
  );
  res.json({ members });
}));

router.delete('/:id/members/:userId', requireAuth, withBatch, requireBatchManager, asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (userId === req.batch.president_id) return res.status(400).json({ error: 'Reassign the president before removing them' });
  const rows = await req.db('DELETE FROM batch_memberships WHERE batch_id = $1 AND user_id = $2 RETURNING id', [req.batch.id, userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Member not found' });
  await audit(req, 'membership.remove', 'batch_membership', rows[0].id, { batch_id: req.batch.id, user_id: userId });
  res.status(204).end();
}));

const POST_SELECT = `
  SELECT p.id, p.batch_id, p.kind, p.body, p.image, p.created_at, p.author_id,
         u.full_name AS author_name, u.profile_pic AS author_pic,
         (SELECT COUNT(*) FROM batch_likes l WHERE l.post_id = p.id)::int AS like_count,
         EXISTS (SELECT 1 FROM batch_likes l WHERE l.post_id = p.id AND l.user_id = $2) AS liked_by_me,
         (SELECT COUNT(*) FROM batch_comments c WHERE c.post_id = p.id)::int AS comment_count
  FROM batch_posts p JOIN users u ON u.id = p.author_id`;

router.get('/:id/posts', requireAuth, withBatch, requireBatchMember, asyncHandler(async (req, res) => {
  const kind = ['post', 'announcement'].includes(req.query.kind) ? req.query.kind : null;
  const photosOnly = req.query.photos === '1';
  const posts = await req.db(
    `${POST_SELECT}
     WHERE p.batch_id = $1 AND ($3::text IS NULL OR p.kind = $3) AND (NOT $4::boolean OR p.image IS NOT NULL)
     ORDER BY p.created_at DESC LIMIT 50`,
    [req.batch.id, req.user.id, kind, photosOnly]
  );
  res.json({ posts });
}));

router.post('/:id/posts', requireAuth, withBatch, requireBatchMember, asyncHandler(async (req, res) => {
  const body = (req.body.body || '').trim() || null;
  const image = req.body.image || null;
  const kind = req.body.kind === 'announcement' ? 'announcement' : 'post';
  if (!body && !image) return res.status(400).json({ error: 'Write something or attach a photo' });
  if (body && body.length > 5000) return res.status(400).json({ error: 'Post is too long' });
  if (image && !validImage(image)) return res.status(400).json({ error: 'Photo must be an image under 3MB' });
  if (kind === 'announcement' && !req.isManager) return res.status(403).json({ error: 'Only the batch president can publish announcements' });

  const [created] = await req.db(
    `INSERT INTO batch_posts (school_id, batch_id, author_id, kind, body, image) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [req.school.id, req.batch.id, req.user.id, kind, body, image]
  );
  if (kind === 'announcement') {
    const members = await req.db(`SELECT user_id FROM batch_memberships WHERE batch_id = $1 AND status = 'approved' AND user_id <> $2`, [req.batch.id, req.user.id]);
    for (const m of members) {
      await createNotification(req.db, {
        userId: m.user_id, type: 'announcement', title: `New announcement in ${req.batch.name}`,
        body: (body || '').slice(0, 140), link: `/batches/${req.batch.id}/community`,
      });
    }
  }
  const [post] = await req.db(`${POST_SELECT} WHERE p.id = $1`, [created.id, req.user.id]);
  res.status(201).json({ post });
}));

async function loadPost(req, res, next) {
  if (!/^\d+$/.test(req.params.postId)) return res.status(404).json({ error: 'Post not found' });
  const rows = await req.db('SELECT * FROM batch_posts WHERE id = $1 AND batch_id = $2', [req.params.postId, req.batch.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
  req.post = rows[0];
  next();
}

router.delete('/:id/posts/:postId', requireAuth, withBatch, requireBatchMember, asyncHandler(loadPost), asyncHandler(async (req, res) => {
  if (req.post.author_id !== req.user.id && !req.isManager) return res.status(403).json({ error: 'You cannot remove this post' });
  await req.db('DELETE FROM batch_posts WHERE id = $1', [req.post.id]);
  if (req.post.author_id !== req.user.id) await audit(req, 'post.moderate_delete', 'batch_post', req.post.id, { batch_id: req.batch.id });
  res.status(204).end();
}));

router.post('/:id/posts/:postId/like', requireAuth, withBatch, requireBatchMember, asyncHandler(loadPost), asyncHandler(async (req, res) => {
  const removed = await req.db('DELETE FROM batch_likes WHERE post_id = $1 AND user_id = $2 RETURNING post_id', [req.post.id, req.user.id]);
  if (removed.length === 0) {
    await req.db('INSERT INTO batch_likes (school_id, batch_id, post_id, user_id) VALUES ($1,$2,$3,$4)', [req.school.id, req.batch.id, req.post.id, req.user.id]);
  }
  const [{ count }] = await req.db('SELECT COUNT(*)::int AS count FROM batch_likes WHERE post_id = $1', [req.post.id]);
  res.json({ liked: removed.length === 0, count });
}));

router.get('/:id/posts/:postId/comments', requireAuth, withBatch, requireBatchMember, asyncHandler(loadPost), asyncHandler(async (req, res) => {
  const comments = await req.db(
    `SELECT c.id, c.parent_id, c.body, c.created_at, c.author_id, u.full_name AS author_name, u.profile_pic AS author_pic
     FROM batch_comments c JOIN users u ON u.id = c.author_id
     WHERE c.post_id = $1 ORDER BY c.created_at ASC`,
    [req.post.id]
  );
  res.json({ comments });
}));

router.post('/:id/posts/:postId/comments', requireAuth, withBatch, requireBatchMember, asyncHandler(loadPost), asyncHandler(async (req, res) => {
  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (body.length > 2000) return res.status(400).json({ error: 'Comment is too long' });

  let parent = null;
  if (req.body.parent_id) {
    const p = await req.db('SELECT * FROM batch_comments WHERE id = $1 AND post_id = $2', [req.body.parent_id, req.post.id]);
    if (p.length === 0) return res.status(404).json({ error: 'Parent comment not found' });
    parent = p[0];
  }
  const [row] = await req.db(
    `INSERT INTO batch_comments (school_id, batch_id, post_id, parent_id, author_id, body) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.school.id, req.batch.id, req.post.id, parent ? parent.id : null, req.user.id, body]
  );
  const targets = new Set([req.post.author_id]);
  if (parent) targets.add(parent.author_id);
  targets.delete(req.user.id);
  for (const userId of targets) {
    await createNotification(req.db, {
      userId, type: 'community', title: `${req.user.full_name || 'Someone'} ${parent && parent.author_id === userId ? 'replied to your comment' : 'commented on your post'}`,
      body: body.slice(0, 140), link: `/batches/${req.batch.id}/community`,
    });
  }
  res.status(201).json({ comment: { ...row, author_name: req.user.full_name, author_pic: req.user.profile_pic } });
}));

router.delete('/:id/comments/:commentId', requireAuth, withBatch, requireBatchMember, asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT * FROM batch_comments WHERE id = $1 AND batch_id = $2', [req.params.commentId, req.batch.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
  if (rows[0].author_id !== req.user.id && !req.isManager) return res.status(403).json({ error: 'You cannot remove this comment' });
  await req.db('DELETE FROM batch_comments WHERE id = $1', [rows[0].id]);
  res.status(204).end();
}));

router.get('/:id/events', requireAuth, withBatch, requireBatchMember, asyncHandler(async (req, res) => {
  const events = await req.db(`SELECT e.*, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going')::int AS going_count FROM events e WHERE e.batch_id = $1 ORDER BY e.event_date ASC`, [req.batch.id]);
  res.json({ events });
}));

router.get('/:id/active', requireAuth, withBatch, requireBatchMember, asyncHandler(async (req, res) => {
  const members = await req.db(
    `SELECT u.id, u.full_name, u.profile_pic, MAX(a.at) AS last_active FROM (
       SELECT author_id AS uid, created_at AS at FROM batch_posts WHERE batch_id = $1
       UNION ALL SELECT author_id, created_at FROM batch_comments WHERE batch_id = $1
     ) a JOIN users u ON u.id = a.uid
     GROUP BY u.id ORDER BY last_active DESC LIMIT 6`,
    [req.batch.id]
  );
  res.json({ members });
}));

module.exports = router;
