const crypto = require('crypto');
const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query } = require('../src/db');
const { resetDb, getDefaultSchool, insertUser } = require('./helpers');
const { hashPassword } = require('../src/lib/password');

const WEBHOOK_SECRET = 'test-webhook-secret';

beforeAll(() => { process.env.PAYMONGO_WEBHOOK_SECRET = WEBHOOK_SECRET; });
beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

function signedRequest(payload) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  return { rawBody, header: `t=${timestamp},te=${te},li=deadbeef` };
}

function checkoutPaidEvent(eventId, sessionId, metadata) {
  return {
    data: {
      id: eventId,
      attributes: {
        type: 'checkout_session.payment.paid',
        data: {
          id: sessionId,
          attributes: { metadata },
        },
      },
    },
  };
}

test('rejects a request with a missing/invalid signature', async () => {
  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ data: { id: 'evt_bad' } }));
  expect(res.status).toBe(400);
});

test('creates a new user from a signup webhook event', async () => {
  const school = await getDefaultSchool();
  const password_hash = await hashPassword('secret123');
  const payload = checkoutPaidEvent('evt_signup1', 'cs_signup1', {
    kind: 'signup',
    school_id: String(school.id),
    session_token: 'token-signup1',
    email: 'webhookuser@test.com',
    password_hash,
    full_name: 'Webhook User',
    batch_year: '2020',
    contact: '',
    address: '',
    member_type: 'alumnus',
    profile_pic: 'data:image/jpeg;base64,AAAA',
  });
  const { rawBody, header } = signedRequest(payload);

  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('Paymongo-Signature', header)
    .send(rawBody);

  expect(res.status).toBe(200);

  const rows = await query('SELECT * FROM users WHERE email = $1', ['webhookuser@test.com']);
  expect(rows.length).toBe(1);
  expect(rows[0].paymongo_checkout_session_id).toBe('token-signup1');
  expect(new Date(rows[0].registration_paid_until) > new Date()).toBe(true);
  expect(rows[0].profile_pic).toBe('data:image/jpeg;base64,AAAA');
});

test('extends registration_paid_until from a renewal webhook event', async () => {
  const school = await getDefaultSchool();
  const user = await insertUser({ school_id: school.id, registration_paid_until: new Date(Date.now() + 1000).toISOString() });
  const payload = checkoutPaidEvent('evt_renew1', 'cs_renew1', {
    kind: 'renewal',
    school_id: String(school.id),
    user_id: String(user.id),
  });
  const { rawBody, header } = signedRequest(payload);

  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('Paymongo-Signature', header)
    .send(rawBody);

  expect(res.status).toBe(200);

  const rows = await query('SELECT registration_paid_until FROM users WHERE id = $1', [user.id]);
  const newExpiry = new Date(rows[0].registration_paid_until);
  const almostTwoYearsFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 1.9);
  expect(newExpiry > almostTwoYearsFromNow).toBe(true);
});

test('is idempotent — redelivering the same event does not double-process', async () => {
  const school = await getDefaultSchool();
  const user = await insertUser({ school_id: school.id, registration_paid_until: new Date(Date.now() + 1000).toISOString() });
  const payload = checkoutPaidEvent('evt_dupe1', 'cs_dupe1', {
    kind: 'renewal',
    school_id: String(school.id),
    user_id: String(user.id),
  });
  const { rawBody, header } = signedRequest(payload);

  await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('Paymongo-Signature', header).send(rawBody);
  const rowsAfterFirst = await query('SELECT registration_paid_until FROM users WHERE id = $1', [user.id]);

  await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('Paymongo-Signature', header).send(rawBody);
  const rowsAfterSecond = await query('SELECT registration_paid_until FROM users WHERE id = $1', [user.id]);

  expect(rowsAfterSecond[0].registration_paid_until).toEqual(rowsAfterFirst[0].registration_paid_until);
});
