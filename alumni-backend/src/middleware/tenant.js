const { query, queryForSchool } = require('../db');
const { verifyToken } = require('../lib/token');

function subdomainFrom(host) {
  return (host || '').split('.')[0].split(':')[0];
}

async function resolveTenant(req, res, next) {
  try {
    const slug = subdomainFrom(req.headers.host);
    let school = null;

    const bySlug = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active, registration_open, registration_fee FROM schools WHERE slug = $1', [slug]);
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
            const byId = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active, registration_open, registration_fee FROM schools WHERE id = $1', [payload.school_id]);
            if (byId.length > 0 && byId[0].active) {
              school = byId[0];
            }
          }
        } catch {
          // invalid/expired token — leave school unresolved, fall through to 404
        }
      }
    }

    if (!school && process.env.NODE_ENV !== 'production' && process.env.DEFAULT_SCHOOL_SLUG) {
      const fallback = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active, registration_open, registration_fee FROM schools WHERE slug = $1', [process.env.DEFAULT_SCHOOL_SLUG]);
      if (fallback.length > 0 && fallback[0].active) {
        school = fallback[0];
      }
    }

    if (!school && process.env.SINGLE_TENANT_SLUG) {
      const singleTenant = await query('SELECT id, slug, name, logo, plan, trial_ends_at, active, registration_open, registration_fee FROM schools WHERE slug = $1', [process.env.SINGLE_TENANT_SLUG]);
      if (singleTenant.length > 0 && singleTenant[0].active) {
        school = singleTenant[0];
      }
    }

    if (!school) {
      return res.status(404).json({ error: 'Unknown school' });
    }

    req.school = school;
    req.db = (text, params) => queryForSchool(school.id, text, params);

    const trialExpired = school.plan === 'trial' && new Date(school.trial_ends_at) < new Date();
    const allowlist = ['/api/auth/login', '/api/me', '/api/school'];
    if (trialExpired && !allowlist.includes(req.path)) {
      return res.status(402).json({ error: 'Trial expired', trialEndsAt: school.trial_ends_at });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { resolveTenant };
