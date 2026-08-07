const { pool } = require('../src/db');

afterAll(() => pool.end());

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
