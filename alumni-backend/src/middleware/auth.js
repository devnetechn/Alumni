const { verifyToken } = require('../lib/token');
const { query } = require('../db');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (req.school && payload.school_id !== req.school.id) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const db = req.db || query;
    const rows = await db('SELECT * FROM users WHERE id = $1', [payload.id]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = rows[0];
    delete user.password_hash;
    if (!user.active) return res.status(403).json({ error: 'Account is deactivated' });
    req.user = user;

    const REGISTRATION_ALLOWLIST = ['/api/me', '/api/school', '/api/registration/renew-checkout'];
    const requestPath = req.originalUrl.split('?')[0];
    if (user.registration_paid_until && new Date(user.registration_paid_until) < new Date() && !REGISTRATION_ALLOWLIST.includes(requestPath)) {
      return res.status(402).json({ error: 'Registration expired', registrationPaidUntil: user.registration_paid_until });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function requireOfficer(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.is_batch_leader) {
    return res.status(403).json({ error: 'Officer access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireOfficer };
