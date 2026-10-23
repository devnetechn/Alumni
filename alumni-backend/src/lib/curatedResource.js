const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('./asyncHandler');

const isId = (v) => /^\d+$/.test(String(v));

// Admin-curated content with public reads: GET / (optional ?featured=true), GET /:id,
// and admin-only POST, PATCH /:id, DELETE /:id.
//   table:     table name; selectSql is the base SELECT aliased `t` (may join extras)
//   fields:    columns an admin may set; required: the one that must be non-empty on create
//   intFields: subset of fields that must be numeric ids (or null)
function curatedRouter({ table, listKey, itemKey, selectSql, fields, required, intFields = [] }) {
  const router = express.Router();

  const clean = (v) => (typeof v === 'string' ? v.trim() || null : v);
  const badInt = (body) => intFields.some((f) => body[f] != null && body[f] !== '' && !isId(body[f]));

  router.get('/', asyncHandler(async (req, res) => {
    const where = req.query.featured === 'true' ? 'WHERE t.featured = true' : '';
    const rows = await req.db(`${selectSql} ${where} ORDER BY t.created_at DESC, t.id DESC`);
    res.json({ [listKey]: rows });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const rows = await req.db(`${selectSql} WHERE t.id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ [itemKey]: rows[0] });
  }));

  router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    if (!clean(req.body[required])) return res.status(400).json({ error: `${required} is required` });
    if (badInt(req.body)) return res.status(400).json({ error: 'Invalid id field' });
    const cols = fields.filter((f) => f in req.body);
    try {
      const rows = await req.db(
        `INSERT INTO ${table} (school_id${cols.map((c) => `, ${c}`).join('')})
         VALUES ($1${cols.map((_, i) => `, $${i + 2}`).join('')}) RETURNING id`,
        [req.school.id, ...cols.map((c) => (intFields.includes(c) && req.body[c] === '' ? null : clean(req.body[c])))]
      );
      const [created] = await req.db(`${selectSql} WHERE t.id = $1`, [rows[0].id]);
      res.status(201).json({ [itemKey]: created });
    } catch (err) {
      if (err.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist' });
      throw err;
    }
  }));

  router.patch('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const cols = fields.filter((f) => f in req.body);
    if (cols.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    if (cols.includes(required) && !clean(req.body[required])) return res.status(400).json({ error: `${required} cannot be empty` });
    if (badInt(req.body)) return res.status(400).json({ error: 'Invalid id field' });
    try {
      const rows = await req.db(
        `UPDATE ${table} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING id`,
        [...cols.map((c) => (intFields.includes(c) && req.body[c] === '' ? null : clean(req.body[c]))), req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const [updated] = await req.db(`${selectSql} WHERE t.id = $1`, [rows[0].id]);
      res.json({ [itemKey]: updated });
    } catch (err) {
      if (err.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist' });
      throw err;
    }
  }));

  router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const rows = await req.db(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  }));

  return router;
}

module.exports = { curatedRouter };
