require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

async function migrate() {
  const pool = new Pool({ connectionString });
  for (const file of ['schema.sql', 'migrations_premium.sql']) {
    await pool.query(fs.readFileSync(path.join(__dirname, '../db', file), 'utf8'));
  }
  await pool.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
