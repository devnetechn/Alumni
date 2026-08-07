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

async function monthlyTrend(table, dateColumn) {
  const rows = await query(
    `SELECT to_char(date_trunc('month', ${dateColumn} AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${dateColumn} >= now() - interval '12 months'
     GROUP BY month_key`
  );
  const byMonth = new Map(rows.map((r) => [r.month_key, r.value]));

  const result = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCMonth(cursor.getUTCMonth() - 11);
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

router.get('/stats', asyncHandler(async (req, res) => {
  const [totalAlumni] = await query('SELECT COUNT(*)::int AS c FROM users');
  const [totalEvents] = await query('SELECT COUNT(*)::int AS c FROM events');
  const [totalCheckins] = await query('SELECT COUNT(*)::int AS c FROM event_checkins');
  const [totalMessages] = await query('SELECT COUNT(*)::int AS c FROM messages');

  const registrationsTrend = await monthlyTrend('users', 'created_at');
  const checkinsTrend = await monthlyTrend('event_checkins', 'checked_in_at');
  const eventsByMonthRaw = await monthlyTrend('events', 'event_date');

  const byBatch = await groupCount('users', 'batch_year');
  const byIndustry = await groupCount('users', 'industry');
  const byCourse = await groupCount('users', 'course');
  const topCompanies = await groupCount('users', 'company', { limit: 8 });

  res.json({
    totalAlumni: totalAlumni.c,
    totalEvents: totalEvents.c,
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
