require('dotenv').config();
const { Pool } = require('pg');

async function backfill(pool) {
  const result = await pool.query(`
    UPDATE event_rsvps r
    SET paid = true
    FROM users u
    WHERE r.user_id = u.id
      AND r.paid = false
      AND (u.registration_paid_until IS NULL OR u.registration_paid_until >= now())
    RETURNING r.id
  `);
  return result.rowCount;
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  backfill(pool)
    .then((count) => {
      console.log(`Backfilled paid=true on ${count} existing RSVP row(s).`);
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { backfill };
