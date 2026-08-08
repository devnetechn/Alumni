const { pool, appPool } = require('../src/db');

afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('all expected tables exist after migration', async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const names = rows.map((r) => r.table_name).sort();
  expect(names).toEqual([
    'announcements', 'event_checkins', 'event_rsvps', 'events',
    'group_members', 'group_posts', 'groups', 'jobs',
    'messages', 'notifications', 'schools', 'users',
  ]);
});

test('schools table exists with the expected columns', async () => {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'schools'`
  );
  const names = rows.map((r) => r.column_name).sort();
  expect(names).toEqual(['active', 'created_at', 'id', 'name', 'plan', 'slug']);
});

test('every tenant table has a school_id column', async () => {
  const tables = [
    'users', 'events', 'event_rsvps', 'event_checkins', 'jobs',
    'announcements', 'messages', 'groups', 'group_members', 'group_posts', 'notifications',
  ];
  for (const table of tables) {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'school_id'`,
      [table]
    );
    expect(rows.length).toBe(1);
  }
});

test('every tenant table has row-level security enabled', async () => {
  const tables = [
    'users', 'events', 'event_rsvps', 'event_checkins', 'jobs',
    'announcements', 'messages', 'groups', 'group_members', 'group_posts', 'notifications',
  ];
  for (const table of tables) {
    const { rows } = await pool.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = $1`,
      [table]
    );
    expect(rows[0].relrowsecurity).toBe(true);
  }
});

test('users table has an is_bot column defaulting to false', async () => {
  const { rows } = await pool.query(
    `SELECT data_type, column_default FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'is_bot'`
  );
  expect(rows.length).toBe(1);
  expect(rows[0].data_type).toBe('boolean');
  expect(rows[0].column_default).toContain('false');
});
