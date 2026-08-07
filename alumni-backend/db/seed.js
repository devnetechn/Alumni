require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword } = require('../src/lib/password');

async function seed(pool) {
  const adminHash = await hashPassword('admin123');
  const adminRows = await pool.query(
    `INSERT INTO users (email, password_hash, role, full_name, batch_year, course)
     VALUES ('admin@alumni.local', $1, 'admin', 'System Admin', 2015, 'BSCS')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [adminHash]
  );

  const sampleHash = await hashPassword('password123');
  const alumniData = [
    ['ana.reyes@alumni.local', 'Ana Reyes', 2019, 'BSIT', 'Tech', 'Globex Inc', 'Software Engineer', false, false],
    ['mark.cruz@alumni.local', 'Mark Cruz', 2018, 'BSCS', 'Finance', 'FinCorp', 'Analyst', true, false],
    ['liza.santos@alumni.local', 'Liza Santos', 2020, 'BSIT', 'Tech', 'Globex Inc', 'Product Manager', false, true],
    ['jon.dela.cruz@alumni.local', 'Jon Dela Cruz', 2017, 'BSCE', 'Construction', 'BuildRight', 'Civil Engineer', false, false],
  ];
  for (const [email, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader] of alumniData) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader)
       VALUES ($1,$2,'alumni',$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (email) DO NOTHING`,
      [email, sampleHash, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader]
    );
  }

  const adminId = (await pool.query(`SELECT id FROM users WHERE email = 'admin@alumni.local'`)).rows[0].id;

  const existingEvents = await pool.query('SELECT COUNT(*)::int AS c FROM events');
  if (existingEvents.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO events (title, description, location, event_date, created_by) VALUES
       ('Homecoming 2025', 'Annual alumni homecoming', 'Main Gym', now() - interval '2 months', $1),
       ('Batch 2026 Reunion', 'Reconnect with your batch', 'Function Hall', now() + interval '1 month', $1)`,
      [adminId]
    );
  }

  const existingJobs = await pool.query('SELECT COUNT(*)::int AS c FROM jobs');
  if (existingJobs.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO jobs (title, company, location, description, job_type, is_referral, posted_by) VALUES
       ('Frontend Developer', 'Globex Inc', 'Remote', 'React experience needed', 'job', true, $1),
       ('Marketing Intern', 'BuildRight', 'Cebu City', 'Summer internship', 'internship', false, $1)`,
      [adminId]
    );
  }

  const existingAnnouncements = await pool.query('SELECT COUNT(*)::int AS c FROM announcements');
  if (existingAnnouncements.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO announcements (title, body, posted_by) VALUES
       ('Welcome to the new Alumni Portal', 'We are excited to launch this platform for our community.', $1)`,
      [adminId]
    );
  }
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  seed(pool)
    .then(() => {
      console.log('Seed complete. Default admin login: admin@alumni.local / admin123');
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed };
