require('dotenv').config();
const OpenAI = require('openai');
const { getCoreCounts } = require('../routes/stats');

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!API_KEY) {
  console.warn('OPENAI_API_KEY is not set — the AI support bot will reply with a fixed fallback message.');
}

const defaultClient = API_KEY ? new OpenAI({ apiKey: API_KEY }) : null;

const FALLBACK_REPLY = "Sorry, I'm having trouble answering right now. Please try again in a moment or message an admin directly.";
const NOT_CONFIGURED_REPLY = "The AI assistant isn't configured yet. Please message an admin directly for help.";

const SYSTEM_PROMPT = `You are the IHES Alumni Association assistant, reachable through the Messages page of the alumni portal. You help alumni understand how to use the site (RSVPing to events, browsing jobs, messaging other alumni, updating their profile) and can answer questions about live data using the tools provided. Be concise and friendly.`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_upcoming_events',
      description: 'Get the next 5 upcoming alumni events ordered by date.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_open_jobs',
      description: 'Get the 5 most recently posted job/internship listings.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Get aggregate site stats: total alumni and total events.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

async function get_upcoming_events(db) {
  return db(
    `SELECT title, description, location, event_date FROM events WHERE event_date >= now() ORDER BY event_date ASC LIMIT 5`
  );
}

async function get_open_jobs(db) {
  return db(
    `SELECT title, company, location, job_type, is_referral FROM jobs ORDER BY created_at DESC LIMIT 5`
  );
}

async function get_stats(db) {
  return getCoreCounts(db);
}

const toolImplementations = { get_upcoming_events, get_open_jobs, get_stats };

async function callTool(db, name) {
  const impl = toolImplementations[name];
  if (!impl) return { error: 'unknown tool' };
  try {
    return await impl(db);
  } catch (err) {
    console.error(`ai.js tool "${name}" failed:`, err);
    return { error: `could not run ${name}` };
  }
}

async function generateReply(history, userMessage, db, client = defaultClient) {
  if (!client) return NOT_CONFIGURED_REPLY;

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const first = await client.chat.completions.create({ model: MODEL, messages, tools });
    const choice = first.choices[0].message;

    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      return choice.content || FALLBACK_REPLY;
    }

    const toolMessages = [];
    for (const call of choice.tool_calls) {
      const result = await callTool(db, call.function.name);
      toolMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }

    const second = await client.chat.completions.create({
      model: MODEL,
      messages: [...messages, choice, ...toolMessages],
    });

    return second.choices[0].message.content || FALLBACK_REPLY;
  } catch (err) {
    console.error('ai.js generateReply failed:', err);
    return FALLBACK_REPLY;
  }
}

module.exports = { generateReply, FALLBACK_REPLY, NOT_CONFIGURED_REPLY };
