const { verifyToken } = require('../lib/token');
const { platformQuery } = require('../db');
const { asyncHandler } = require('../lib/asyncHandler');

const requirePlatformAdmin = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (payload.type !== 'platform_admin') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const rows = await platformQuery('SELECT id, email FROM platform_admins WHERE id = $1', [payload.id]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid or expired token' });

  req.platformAdmin = rows[0];
  next();
});

module.exports = { requirePlatformAdmin };
