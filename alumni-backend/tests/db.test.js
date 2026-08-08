const { appPool, queryForSchool } = require('../src/db');

afterAll(() => appPool.end());

test('queryForSchool runs as the restricted alumni_app role, not a superuser', async () => {
  const rows = await queryForSchool(
    1,
    `SELECT current_user AS u, usesuper FROM pg_user WHERE usename = current_user`
  );
  expect(rows[0].u).toBe('alumni_app');
  expect(rows[0].usesuper).toBe(false);
});
