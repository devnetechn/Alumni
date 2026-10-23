const { asyncHandler } = require('./asyncHandler');
const { createNotification } = require('../routes/notifications');

async function loadBatch(req, id) {
  if (!/^\d+$/.test(String(id))) return null;
  const rows = await req.db('SELECT * FROM batches WHERE id = $1', [id]);
  return rows[0] || null;
}

function isBatchManager(user, batch) {
  return user.role === 'admin' || batch.president_id === user.id;
}

// Loads :id as req.batch and resolves the caller's standing. The checks here
// are the application layer; the RLS policies in migrations_premium.sql back
// them up for private batch content.
const withBatch = asyncHandler(async (req, res, next) => {
  const batch = await loadBatch(req, req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  req.batch = batch;
  const rows = await req.db(
    'SELECT * FROM batch_memberships WHERE batch_id = $1 AND user_id = $2',
    [batch.id, req.user.id]
  );
  req.membership = rows[0] || null;
  req.isManager = isBatchManager(req.user, batch);
  req.isMember = req.isManager || (req.membership && req.membership.status === 'approved');
  next();
});

function requireBatchMember(req, res, next) {
  if (!req.isMember) return res.status(403).json({ error: 'Approved batch membership required' });
  next();
}

function requireBatchManager(req, res, next) {
  if (!req.isManager) return res.status(403).json({ error: 'Batch president or admin access required' });
  next();
}

async function audit(req, action, entity, entityId, meta) {
  await req.db(
    'INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.school.id, req.user.id, action, entity, entityId || null, meta ? JSON.stringify(meta) : null]
  );
}

async function notifyRequestSubmitted(db, batch, user) {
  await createNotification(db, {
    userId: user.id, type: 'membership', title: 'Membership request submitted',
    body: `Your request to join ${batch.name} is awaiting review by the batch president.`, link: '/membership',
  });
  if (batch.president_id) {
    await createNotification(db, {
      userId: batch.president_id, type: 'membership', title: 'New membership request',
      body: `${user.full_name || user.email} asked to join ${batch.name}.`, link: '/president',
    });
  }
}

module.exports = { notifyRequestSubmitted, loadBatch, isBatchManager, withBatch, requireBatchMember, requireBatchManager, audit };
