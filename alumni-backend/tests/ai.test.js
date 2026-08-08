const { generateReply, FALLBACK_REPLY, NOT_CONFIGURED_REPLY } = require('../src/lib/ai');
const { pool, appPool, query } = require('../src/db');
const { resetDb } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

test('returns the not-configured fallback when no client is available', async () => {
  const reply = await generateReply([], 'Hello', null);
  expect(reply).toBe(NOT_CONFIGURED_REPLY);
});

test("returns the model's direct text reply when no tool call is requested", async () => {
  const fakeClient = {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'You can RSVP from the Events page.', tool_calls: undefined } }],
        }),
      },
    },
  };
  const reply = await generateReply([], 'How do I RSVP?', fakeClient);
  expect(reply).toBe('You can RSVP from the Events page.');
  expect(fakeClient.chat.completions.create).toHaveBeenCalledTimes(1);
});

test('executes a requested tool call against the real database and feeds the result back', async () => {
  await query(
    `INSERT INTO events (title, description, location, event_date) VALUES ($1,$2,$3, now() + interval '1 day')`,
    ['Homecoming', 'desc', 'Gym']
  );
  const fakeClient = {
    chat: {
      completions: {
        create: jest.fn()
          .mockResolvedValueOnce({
            choices: [{
              message: {
                content: null,
                tool_calls: [{ id: 'call_1', function: { name: 'get_upcoming_events', arguments: '{}' } }],
              },
            }],
          })
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'The next event is Homecoming.' } }],
          }),
      },
    },
  };
  const reply = await generateReply([], 'What events are coming up?', fakeClient);
  expect(reply).toBe('The next event is Homecoming.');
  expect(fakeClient.chat.completions.create).toHaveBeenCalledTimes(2);
  const secondCallArgs = fakeClient.chat.completions.create.mock.calls[1][0];
  const toolMsg = secondCallArgs.messages.find((m) => m.role === 'tool');
  expect(toolMsg.tool_call_id).toBe('call_1');
  expect(JSON.parse(toolMsg.content)[0].title).toBe('Homecoming');
});

test('returns the fallback reply when the OpenAI call throws', async () => {
  const fakeClient = {
    chat: { completions: { create: jest.fn().mockRejectedValue(new Error('network down')) } },
  };
  const reply = await generateReply([], 'Hello', fakeClient);
  expect(reply).toBe(FALLBACK_REPLY);
});

test('returns the fallback reply, not a crash, when a tool call fails internally', async () => {
  const fakeClient = {
    chat: {
      completions: {
        create: jest.fn()
          .mockResolvedValueOnce({
            choices: [{
              message: {
                content: null,
                tool_calls: [{ id: 'call_1', function: { name: 'get_open_jobs', arguments: '{}' } }],
              },
            }],
          })
          .mockResolvedValueOnce({
            choices: [{ message: { content: "I couldn't check that right now, but feel free to browse Jobs directly." } }],
          }),
      },
    },
  };
  const reply = await generateReply([], 'What jobs are open?', fakeClient);
  expect(reply).toBe("I couldn't check that right now, but feel free to browse Jobs directly.");
});
