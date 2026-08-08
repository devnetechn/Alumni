const { pool, appPool } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, createSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('insertUser without an explicit school_id uses a lazily-created default school', async () => {
  const user = await insertUser();
  const school = await getDefaultSchool();
  expect(user.school_id).toBe(school.id);
});

test('insertUser respects an explicit school_id override', async () => {
  const otherSchool = await createSchool();
  const user = await insertUser({ school_id: otherSchool.id });
  expect(user.school_id).toBe(otherSchool.id);
});

test('hostFor formats a school into a subdomain host header value', async () => {
  const school = await createSchool({ slug: 'my-slug' });
  expect(hostFor(school)).toBe('my-slug.example.com');
});

test('resetDb creates a fresh default school after truncating', async () => {
  const first = await getDefaultSchool();
  await resetDb();
  const second = await getDefaultSchool();
  expect(second.id).toBe(first.id); // ids restart at 1 after RESTART IDENTITY
  expect(second.slug).toBe('test-school');
});
