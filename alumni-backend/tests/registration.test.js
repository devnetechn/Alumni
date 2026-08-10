const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, query } = require('../src/db');
const { resetDb, insertUser, getDefaultSchool, hostFor, authHeader } = require('./helpers');
const paymongo = require('../src/lib/paymongo');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));
afterEach(() => jest.restoreAllMocks());

test('POST /api/registration/signup-checkout rejects when registration is closed', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_open = false WHERE id = $1', [school.id]);

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(400);
});

test('POST /api/registration/signup-checkout rejects when no fee is configured', async () => {
  const school = await getDefaultSchool();

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(400);
});

test('POST /api/registration/signup-checkout succeeds without a profile_pic (optional)', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_nopic', checkoutUrl: 'https://checkout.paymongo.com/cs_nopic' });

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'nopic@test.com', password: 'secret123', full_name: 'No Pic' });

  expect(res.status).toBe(200);
  const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
  const staged = await query('SELECT * FROM pending_signups WHERE session_token = $1', [callArgs.metadata.session_token]);
  expect(staged[0].profile_pic).toBeNull();
});

test('POST /api/registration/signup-checkout creates a checkout session and returns its URL', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_test123', checkoutUrl: 'https://checkout.paymongo.com/cs_test123' });

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'new@test.com', password: 'secret123', full_name: 'New Person', member_type: 'guest', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(200);
  expect(res.body.checkoutUrl).toBe('https://checkout.paymongo.com/cs_test123');
  expect(paymongo.createCheckoutSession).toHaveBeenCalledTimes(1);
  const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
  expect(callArgs.lineItems[0].amount).toBe(20000);
  expect(callArgs.metadata.kind).toBe('signup');
  expect(callArgs.metadata.session_token).toBeTruthy();
  expect(callArgs.successUrl).toContain(`session_id=${callArgs.metadata.session_token}`);
  // The full signup (including the photo) must NOT ride through PayMongo
  // metadata -- confirmed via direct testing that PayMongo's checkout
  // metadata silently fails on real (high-entropy) values like a photo,
  // even at sizes well under its documented-looking limits. Only the
  // small, low-entropy session_token goes to PayMongo; everything else
  // is staged in pending_signups instead.
  expect(callArgs.metadata.email).toBeUndefined();
  expect(callArgs.metadata.password_hash).toBeUndefined();
  expect(callArgs.metadata.profile_pic).toBeUndefined();

  const staged = await query('SELECT * FROM pending_signups WHERE session_token = $1', [callArgs.metadata.session_token]);
  expect(staged.length).toBe(1);
  expect(staged[0].email).toBe('new@test.com');
  expect(staged[0].member_type).toBe('guest');
  expect(staged[0].password_hash).toBeTruthy();
  expect(staged[0].password_hash).not.toBe('secret123');
  expect(staged[0].profile_pic).toBe('data:image/jpeg;base64,AAAA');
});

test('POST /api/registration/signup-checkout uses FRONTEND_URL for success/cancel URLs when set, not the request Host', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_fe', checkoutUrl: 'https://checkout.paymongo.com/cs_fe' });
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://alumni-six-wine.vercel.app';

  try {
    const res = await request(app)
      .post('/api/registration/signup-checkout')
      .set('Host', hostFor(school))
      .send({ email: 'fe-url@test.com', password: 'secret123', full_name: 'FE Url', profile_pic: 'data:image/jpeg;base64,AAAA' });

    expect(res.status).toBe(200);
    const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
    expect(callArgs.successUrl).toBe(`https://alumni-six-wine.vercel.app/register/success?session_id=${callArgs.metadata.session_token}`);
    expect(callArgs.cancelUrl).toBe('https://alumni-six-wine.vercel.app/register');
  } finally {
    process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('POST /api/registration/signup-checkout rejects a duplicate email', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  await insertUser({ email: 'dupe@test.com' });

  const res = await request(app)
    .post('/api/registration/signup-checkout')
    .set('Host', hostFor(school))
    .send({ email: 'dupe@test.com', password: 'secret123', full_name: 'Dupe', profile_pic: 'data:image/jpeg;base64,AAAA' });

  expect(res.status).toBe(409);
});

test('GET /api/registration/signup-checkout/:sessionId/status returns not-ready before the webhook fires', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .get('/api/registration/signup-checkout/cs_nonexistent/status')
    .set('Host', hostFor(school));
  expect(res.status).toBe(200);
  expect(res.body.ready).toBe(false);
});

test('GET /api/registration/signup-checkout/:sessionId/status returns a token once the user exists', async () => {
  const school = await getDefaultSchool();
  const user = await insertUser({ paymongo_checkout_session_id: 'cs_done123' });

  const res = await request(app)
    .get('/api/registration/signup-checkout/cs_done123/status')
    .set('Host', hostFor(school));

  expect(res.status).toBe(200);
  expect(res.body.ready).toBe(true);
  expect(res.body.token).toBeTruthy();
  expect(res.body.user.id).toBe(user.id);
});

test('POST /api/registration/renew-checkout requires auth', async () => {
  const school = await getDefaultSchool();
  const res = await request(app)
    .post('/api/registration/renew-checkout')
    .set('Host', hostFor(school));
  expect(res.status).toBe(401);
});

test('POST /api/registration/renew-checkout creates a renewal checkout session', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  const user = await insertUser();
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_renew1', checkoutUrl: 'https://checkout.paymongo.com/cs_renew1' });

  const res = await request(app)
    .post('/api/registration/renew-checkout')
    .set('Host', hostFor(school))
    .set('Authorization', authHeader(user));

  expect(res.status).toBe(200);
  expect(res.body.checkoutUrl).toBe('https://checkout.paymongo.com/cs_renew1');
  const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
  expect(callArgs.metadata.kind).toBe('renewal');
  expect(callArgs.metadata.user_id).toBe(String(user.id));
});

test('POST /api/registration/renew-checkout uses FRONTEND_URL for success/cancel URLs when set, not the request Host', async () => {
  const school = await getDefaultSchool();
  await query('UPDATE schools SET registration_fee = 20000 WHERE id = $1', [school.id]);
  const user = await insertUser();
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_renew_fe', checkoutUrl: 'https://checkout.paymongo.com/cs_renew_fe' });
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://alumni-six-wine.vercel.app';

  try {
    const res = await request(app)
      .post('/api/registration/renew-checkout')
      .set('Host', hostFor(school))
      .set('Authorization', authHeader(user));

    expect(res.status).toBe(200);
    const callArgs = paymongo.createCheckoutSession.mock.calls[0][0];
    expect(callArgs.successUrl).toBe('https://alumni-six-wine.vercel.app/dashboard');
    expect(callArgs.cancelUrl).toBe('https://alumni-six-wine.vercel.app/dashboard');
  } finally {
    process.env.FRONTEND_URL = originalFrontendUrl;
  }
});
