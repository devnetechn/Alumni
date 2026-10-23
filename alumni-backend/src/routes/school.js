const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { audit } = require('../lib/batchAccess');
const { query } = require('../db');

const router = express.Router();

function publicSchool(school) {
  return {
    name: school.name,
    logo: school.logo,
    about: school.about,
    overview_title: school.overview_title,
    overview_body: school.overview_body,
    overview_image: school.overview_image,
    contact_email: school.contact_email,
    contact_phone: school.contact_phone,
    contact_address: school.contact_address,
    facebook_url: school.facebook_url,
    registration_open: school.registration_open,
    registration_fee: school.registration_fee,
  };
}

router.get('/school', asyncHandler(async (req, res) => {
  res.json(publicSchool(req.school));
}));

const EDITABLE = ['about', 'overview_title', 'overview_body', 'overview_image', 'contact_email', 'contact_phone', 'contact_address', 'facebook_url'];

router.patch('/school', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const cols = EDITABLE.filter((c) => c in req.body);
  if (cols.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  const rows = await query(
    `UPDATE schools SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`,
    [...cols.map((c) => String(req.body[c] || '').trim() || null), req.school.id]
  );
  await audit(req, 'school.update', 'school', req.school.id, { fields: cols });
  res.json(publicSchool(rows[0]));
}));

module.exports = router;
