const { query, queryForSchool } = require('../db');
const { verifyToken } = require('../lib/token');

function subdomainFrom(host) {
  return (host || '').split('.')[0].split(':')[0];
}

async function resolveTenant(req, res, next) {
  try {
    const slug = subdomainFrom(req.headers.host);
    let school = null;

    const bySlug = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active FROM schools WHERE slug = $1', [slug]);
    if (bySlug.length > 0 && bySlug[0].active) {
      school = bySlug[0];
    }

    if (!school) {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (token) {
        try {
          const payload = verifyToken(token);
          if (payload.school_id) {
            const byId = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active FROM schools WHERE id = $1', [payload.school_id]);
            if (byId.length > 0 && byId[0].active) {
              school = byId[0];
            }
          }
        } catch {
          // invalid/expired token — leave school unresolved, fall through to 404
        }
      }
    }

    if (!school) {
      return res.status(404).json({ error: 'Unknown school' });
    }

    req.school = school;
    req.db = (text, params) => queryForSchool(school.id, text, params);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { resolveTenant };
