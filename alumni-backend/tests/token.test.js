const { signToken, verifyToken } = require('../src/lib/token');

test('signToken embeds school_id in the payload', () => {
  const token = signToken({ id: 7, role: 'alumni', school_id: 3 });
  const payload = verifyToken(token);
  expect(payload.id).toBe(7);
  expect(payload.role).toBe('alumni');
  expect(payload.school_id).toBe(3);
});
