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
    'messages', 'notifications', 'users',
  ]);
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
