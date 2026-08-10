const { pool, query } = require('../src/db');
const { hashPassword } = require('../src/lib/password');
const { signToken } = require('../src/lib/token');

let defaultSchool = null;

async function resetDb() {
  defaultSchool = null;
  await pool.query(`
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_photos, partners, officers, event_checkins, event_rsvps, events, users, schools, platform_admins,
      processed_webhook_events, pending_signups
    RESTART IDENTITY CASCADE
  `);
}

async function getDefaultSchool() {
  if (defaultSchool) return defaultSchool;
  const rows = await query(
    `INSERT INTO schools (slug, name) VALUES ('test-school', 'Test School') RETURNING id, slug`
  );
  defaultSchool = rows[0];
  return defaultSchool;
}

async function createSchool(overrides = {}) {
  const defaults = {
    slug: `school${Date.now()}${Math.random().toString(16).slice(2)}`,
    name: 'Another School',
  };
  const data = { ...defaults, ...overrides };
  const rows = await query(
    `INSERT INTO schools (slug, name) VALUES ($1,$2) RETURNING id, slug, name`,
    [data.slug, data.name]
  );
  return rows[0];
}

function hostFor(school) {
  return `${school.slug}.example.com`;
}

async function insertUser(overrides = {}) {
  const password_hash = await hashPassword('password123');
  const school_id = overrides.school_id || (await getDefaultSchool()).id;
  const defaults = {
    email: `user${Date.now()}${Math.random().toString(16).slice(2)}@test.com`,
    role: 'alumni',
    active: true,
    is_batch_leader: false,
    full_name: 'Test User',
    batch_year: 2020,
    course: 'BSCS',
  };
  const data = { ...defaults, ...overrides, password_hash, school_id };
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query(
    `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return rows[0];
}

function authHeader(user) {
  return `Bearer ${signToken(user)}`;
}

module.exports = { resetDb, insertUser, authHeader, getDefaultSchool, createSchool, hostFor };
