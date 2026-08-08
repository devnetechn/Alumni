const request = require('supertest');
const { app } = require('../src/server');
const { pool, query } = require('../src/db');
const { resetDb, insertUser, authHeader } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());

test('POST /api/messages sends a message', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  const res = await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(a))
    .send({ receiver_id: b.id, body: 'Hey Bob!' });
  expect(res.status).toBe(201);
  expect(res.body.message.body).toBe('Hey Bob!');
});

test('POST /api/messages creates a notification for the recipient', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(a))
    .send({ receiver_id: b.id, body: 'Hey Bob!' });

  const rows = await query('SELECT * FROM notifications WHERE user_id = $1', [b.id]);
  expect(rows.length).toBe(1);
  expect(rows[0].type).toBe('message');
  expect(rows[0].title).toContain('Alice');
});

test('GET /api/messages lists conversations with last message and unread count', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  await request(app).post('/api/messages').set('Authorization', authHeader(a)).send({ receiver_id: b.id, body: 'First' });
  await request(app).post('/api/messages').set('Authorization', authHeader(a)).send({ receiver_id: b.id, body: 'Second' });

  const res = await request(app).get('/api/messages').set('Authorization', authHeader(b));
  expect(res.status).toBe(200);
  expect(res.body.conversations.length).toBe(1);
  expect(res.body.conversations[0].other_id).toBe(a.id);
  expect(res.body.conversations[0].last_body).toBe('Second');
  expect(res.body.conversations[0].unread_count).toBe(2);
});

test('GET /api/messages/:userId returns the thread and marks messages read', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  await request(app).post('/api/messages').set('Authorization', authHeader(a)).send({ receiver_id: b.id, body: 'Hi' });

  const thread = await request(app).get(`/api/messages/${a.id}`).set('Authorization', authHeader(b));
  expect(thread.status).toBe(200);
  expect(thread.body.messages.length).toBe(1);
  expect(thread.body.other.full_name).toBe('Alice');

  const convos = await request(app).get('/api/messages').set('Authorization', authHeader(b));
  expect(convos.body.conversations[0].unread_count).toBe(0);
});

test('POST /api/messages to the bot triggers an automatic reply from the bot', async () => {
  const user = await insertUser({ full_name: 'Alice' });
  const bot = await insertUser({ is_bot: true, full_name: 'IHES Assistant', email: 'bot@ihes.local' });

  const res = await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(user))
    .send({ receiver_id: bot.id, body: 'How do I RSVP to an event?' });
  expect(res.status).toBe(201);

  await new Promise((resolve) => setTimeout(resolve, 100));

  const rows = await query(
    `SELECT * FROM messages WHERE sender_id = $1 AND receiver_id = $2 ORDER BY created_at ASC`,
    [bot.id, user.id]
  );
  expect(rows.length).toBe(1);
  expect(rows[0].body.length).toBeGreaterThan(0);
});

test('POST /api/messages to a human does not trigger a bot reply', async () => {
  const a = await insertUser({ full_name: 'Alice' });
  const b = await insertUser({ full_name: 'Bob' });
  await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(a))
    .send({ receiver_id: b.id, body: 'Hi Bob' });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const rows = await query('SELECT * FROM messages WHERE sender_id = $1', [b.id]);
  expect(rows.length).toBe(0);
});
