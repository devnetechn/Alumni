require('dotenv').config();
const { Pool } = require('pg');

function resolveConnectionString(varName) {
  const value = process.env.NODE_ENV === 'test'
    ? process.env[`TEST_${varName}`]
    : process.env[varName];
  if (!value) {
    throw new Error(
      `Database connection string is not set. Expected ${process.env.NODE_ENV === 'test' ? `TEST_${varName}` : varName} in your .env file.`
    );
  }
  return value;
}

const pool = new Pool({ connectionString: resolveConnectionString('DATABASE_URL') });
const appPool = new Pool({ connectionString: resolveConnectionString('APP_DATABASE_URL') });
const platformPool = new Pool({ connectionString: resolveConnectionString('PLATFORM_DATABASE_URL') });

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function platformQuery(text, params) {
  const result = await platformPool.query(text, params);
  return result.rows;
}

async function queryForSchool(schoolId, text, params) {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.school_id', $1, true)`, [String(schoolId)]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, appPool, platformPool, query, queryForSchool, platformQuery };
