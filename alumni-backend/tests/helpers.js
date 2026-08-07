const { pool, query } = require('../src/db');
const { hashPassword } = require('../src/lib/password');
const { signToken } = require('../src/lib/token');

async function resetDb() {
  await pool.query(`
    TRUNCATE TABLE
      notifications, group_posts, group_members, groups,
      messages, announcements, jobs,
      event_checkins, event_rsvps, events, users
    RESTART IDENTITY CASCADE
  `);
}

async function insertUser(overrides = {}) {
  const password_hash = await hashPassword('password123');
  const defaults = {
    email: `user${Date.now()}${Math.random().toString(16).slice(2)}@test.com`,
    role: 'alumni',
    active: true,
    is_batch_leader: false,
    full_name: 'Test User',
    batch_year: 2020,
    course: 'BSCS',
  };
  const data = { ...defaults, ...overrides, password_hash };
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

module.exports = { resetDb, insertUser, authHeader };
