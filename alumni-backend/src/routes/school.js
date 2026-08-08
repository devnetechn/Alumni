const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/school', asyncHandler(async (req, res) => {
  res.json({ name: req.school.name, logo: req.school.logo });
}));

module.exports = router;
