const { io: ioClient } = require('socket.io-client');
const request = require('supertest');
const { app, server } = require('../src/server');
const { pool, appPool, queryForSchool } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool } = require('./helpers');
const { signToken } = require('../src/lib/token');
const { createNotification } = require('../src/routes/notifications');

let port;

beforeAll((done) => {
  server.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  Promise.all([pool.end(), appPool.end()]).then(() => server.close(done));
});

beforeEach(() => resetDb());

function connectAs(user) {
  return ioClient(`http://localhost:${port}`, {
    auth: { token: signToken(user) },
    transports: ['websocket'],
  });
}

test('receiver gets a message:new event when a message is sent', async () => {
  const alice = await insertUser({ full_name: 'Alice' });
  const bob = await insertUser({ full_name: 'Bob' });

  const bobSocket = connectAs(bob);
  await new Promise((resolve) => bobSocket.on('connect', resolve));

  const received = new Promise((resolve) => bobSocket.on('message:new', resolve));

  await request(app)
    .post('/api/messages')
    .set('Authorization', authHeader(alice))
    .send({ receiver_id: bob.id, body: 'Hi Bob via socket' });

  const payload = await received;
  expect(payload.body).toBe('Hi Bob via socket');

  bobSocket.close();
});

test('createNotification emits a notification:new event to that user', async () => {
  const user = await insertUser();
  const userSocket = connectAs(user);
  await new Promise((resolve) => userSocket.on('connect', resolve));

  const received = new Promise((resolve) => userSocket.on('notification:new', resolve));
  const school = await getDefaultSchool();
  const db = (text, params) => queryForSchool(school.id, text, params);
  await createNotification(db, { userId: user.id, type: 'info', title: 'Ping' });

  const payload = await received;
  expect(payload.title).toBe('Ping');

  userSocket.close();
});

test('a socket with an invalid token gets disconnected', async () => {
  const socket = ioClient(`http://localhost:${port}`, {
    auth: { token: 'not-a-real-token' },
    transports: ['websocket'],
  });
  const disconnected = new Promise((resolve) => socket.on('disconnect', resolve));
  await disconnected;
});
