const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

function monthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

async function monthlyTrend(table, dateColumn) {
  const rows = await query(
    `SELECT date_trunc('month', ${dateColumn}) AS month, COUNT(*)::int AS value
     FROM ${table}
     WHERE ${dateColumn} >= now() - interval '12 months'
     GROUP BY month`
  );
  const byMonth = new Map(rows.map((r) => [r.month.toISOString().slice(0, 7), r.value]));

  const result = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 11);
  for (let i = 0; i < 12; i++) {
    const key = cursor.toISOString().slice(0, 7);
    result.push({ label: monthLabel(cursor), value: byMonth.get(key) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
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
