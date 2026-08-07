const { pool, query } = require('../src/db');
const { seed } = require('../db/seed');
const { resetDb } = require('./helpers');

afterAll(() => pool.end());
beforeEach(() => resetDb());

test('seed creates the default admin and sample data', async () => {
  await seed(pool);

  const admins = await query(`SELECT * FROM users WHERE email = 'admin@alumni.local'`);
  expect(admins.length).toBe(1);
  expect(admins[0].role).toBe('admin');

  const alumni = await query(`SELECT * FROM users WHERE role = 'alumni'`);
  expect(alumni.length).toBeGreaterThanOrEqual(4);

  const events = await query('SELECT * FROM events');
  expect(events.length).toBeGreaterThanOrEqual(2);

  const jobs = await query('SELECT * FROM jobs');
  expect(jobs.length).toBeGreaterThanOrEqual(2);

  const announcements = await query('SELECT * FROM announcements');
  expect(announcements.length).toBeGreaterThanOrEqual(1);
});

test('seed is idempotent — running twice does not duplicate the admin', async () => {
  await seed(pool);
  await seed(pool);
  const admins = await query(`SELECT * FROM users WHERE email = 'admin@alumni.local'`);
  expect(admins.length).toBe(1);
});
