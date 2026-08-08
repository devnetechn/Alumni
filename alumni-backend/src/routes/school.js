const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

router.get('/school', asyncHandler(async (req, res) => {
  res.json({
    name: req.school.name,
    logo: req.school.logo,
    registration_open: req.school.registration_open,
    registration_fee: req.school.registration_fee,
  });
}));

module.exports = router;
