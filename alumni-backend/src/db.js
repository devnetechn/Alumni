require('dotenv').config();
const { Pool } = require('pg');

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    `Database connection string is not set. Expected ${process.env.NODE_ENV === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} in your .env file.`
  );
}

const pool = new Pool({ connectionString });

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

module.exports = { pool, query };
