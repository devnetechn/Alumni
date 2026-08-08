const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

async function monthlyTrend(table, dateColumn, monthsBack = 11) {
  // Lower bound uses a 1-month safety buffer so day-of-month offsets in
  // `now()` never clip rows that fall in the earliest displayed month
  // (matches the original behavior, which used a fixed 12-month buffer
  // for an 11-months-back window). No upper bound is applied — future
  // rows are fetched and grouped, but only ones whose month falls inside
  // the displayed window (see cursor loop below) actually get shown.
  const rows = await query(
    `SELECT to_char(date_trunc('month', ${dateColumn} AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${dateColumn} >= now() - interval '${monthsBack + 1} months'
     GROUP BY month_key`
  );
  const byMonth = new Map(rows.map((r) => [r.month_key, r.value]));

  const result = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCMonth(cursor.getUTCMonth() - monthsBack);
  for (let i = 0; i < 12; i++) {
    result.push({ label: monthLabel(cursor), value: byMonth.get(monthKey(cursor)) || 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

async function groupCount(table, column, { limit } = {}) {
  const rows = await query(
    `SELECT ${column} AS label, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${column} IS NOT NULL
     GROUP BY ${column}
     ORDER BY value DESC
     ${limit ? `LIMIT ${limit}` : ''}`
  );
  return rows.map((r) => ({ label: String(r.label), value: r.value }));
}

async function getCoreCounts() {
  const [totalAlumniRow] = await query('SELECT COUNT(*)::int AS c FROM users WHERE is_bot = false');
  const [totalEventsRow] = await query('SELECT COUNT(*)::int AS c FROM events');
  return { totalAlumni: totalAlumniRow.c, totalEvents: totalEventsRow.c };
}

router.get('/stats', asyncHandler(async (req, res) => {
  const { totalAlumni, totalEvents } = await getCoreCounts();
  const [totalCheckins] = await query('SELECT COUNT(*)::int AS c FROM event_checkins');
  const [totalMessages] = await query('SELECT COUNT(*)::int AS c FROM messages');

  const registrationsTrend = await monthlyTrend('users', 'created_at');
  const checkinsTrend = await monthlyTrend('event_checkins', 'checked_in_at');
  const eventsByMonthRaw = await monthlyTrend('events', 'event_date', 5);

  const byBatch = await groupCount('users', 'batch_year');
  const byIndustry = await groupCount('users', 'industry');
  const byCourse = await groupCount('users', 'course');
  const topCompanies = await groupCount('users', 'company', { limit: 8 });

  res.json({
    totalAlumni,
    totalEvents,
    totalCheckins: totalCheckins.c,
    totalMessages: totalMessages.c,
    registrationsTrend,
    checkinsTrend,
    eventsByMonth: eventsByMonthRaw,
    byBatch,
    byIndustry,
    byCourse,
    topCompanies,
  });
}));

module.exports = router;
module.exports.getCoreCounts = getCoreCounts;
