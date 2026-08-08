const request = require('supertest');
const ai = require('../src/lib/ai');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const { resetDb, createSchool, hostFor } = require('./helpers');

afterAll(() => pool.end());

describe('POST /api/chat', () => {
  beforeEach(async () => {
    await resetDb();
    jest.spyOn(ai, 'generateReply').mockResolvedValue('mocked reply');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns a reply for a fresh visitor', async () => {
    const school = await createSchool();
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'When is the next event?', visitorId: 'visitor-1' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('mocked reply');
    expect(res.body.remaining).toBe(9);
  });

  test('missing message returns 400', async () => {
    const school = await createSchool();
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ visitorId: 'visitor-1' });
    expect(res.status).toBe(400);
  });

  test('missing visitorId returns 400', async () => {
    const school = await createSchool();
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'hi' });
    expect(res.status).toBe(400);
  });

  test('the 11th message from the same visitor is rejected and does not call generateReply again', async () => {
    const school = await createSchool();
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/chat')
        .set('Host', hostFor(school))
        .send({ message: `question ${i}`, visitorId: 'capped-visitor' });
      expect(res.status).toBe(200);
    }
    expect(ai.generateReply).toHaveBeenCalledTimes(10);

    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'one more', visitorId: 'capped-visitor' });

    expect(res.status).toBe(429);
    expect(ai.generateReply).toHaveBeenCalledTimes(10);
  });

  test('two different visitorIds on the same school are tracked independently', async () => {
    const school = await createSchool();
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/chat')
        .set('Host', hostFor(school))
        .send({ message: `question ${i}`, visitorId: 'visitor-a' });
    }
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(school))
      .send({ message: 'first question', visitorId: 'visitor-b' });

    expect(res.status).toBe(200);
  });

  test('the same visitorId on two different schools is tracked independently', async () => {
    const schoolA = await createSchool();
    const schoolB = await createSchool();
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/chat')
        .set('Host', hostFor(schoolA))
        .send({ message: `question ${i}`, visitorId: 'shared-visitor' });
    }
    const res = await request(app)
      .post('/api/chat')
      .set('Host', hostFor(schoolB))
      .send({ message: 'first question here', visitorId: 'shared-visitor' });

    expect(res.status).toBe(200);
  });
});
