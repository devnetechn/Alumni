require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword } = require('../src/lib/password');

async function seed(pool) {
  const schoolRows = await pool.query(
    `INSERT INTO schools (slug, name) VALUES ('ihes', 'IHES Alumni Association')
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`
  );
  const ihesId = schoolRows.rows[0]
    ? schoolRows.rows[0].id
    : (await pool.query(`SELECT id FROM schools WHERE slug = 'ihes'`)).rows[0].id;

  const demoSchoolHash = await hashPassword('admin123');
  await pool.query(
    `INSERT INTO schools (slug, name) VALUES ('demo-school', 'Demo School') ON CONFLICT (slug) DO NOTHING`
  );
  const demoSchoolId = (await pool.query(`SELECT id FROM schools WHERE slug = 'demo-school'`)).rows[0].id;
  await pool.query(
    `INSERT INTO users (school_id, email, password_hash, role, full_name)
     VALUES ($1, 'admin@demo-school.local', $2, 'admin', 'Demo School Admin')
     ON CONFLICT (school_id, email) DO NOTHING`,
    [demoSchoolId, demoSchoolHash]
  );

  const adminHash = await hashPassword('admin123');
  const adminRows = await pool.query(
    `INSERT INTO users (school_id, email, password_hash, role, full_name, batch_year, course)
     VALUES ($1, 'admin@alumni.local', $2, 'admin', 'System Admin', 2015, 'BSCS')
     ON CONFLICT (school_id, email) DO NOTHING
     RETURNING id`,
    [ihesId, adminHash]
  );

  const botHash = await hashPassword(require('crypto').randomBytes(24).toString('hex'));
  await pool.query(
    `INSERT INTO users (school_id, email, password_hash, role, full_name, active, is_bot)
     VALUES ($1, 'bot@ihes.local', $2, 'alumni', 'IHES Assistant', true, true)
     ON CONFLICT (school_id, email) DO NOTHING`,
    [ihesId, botHash]
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
      `INSERT INTO users (school_id, email, password_hash, role, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader)
       VALUES ($1,$2,$3,'alumni',$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (school_id, email) DO NOTHING`,
      [ihesId, email, sampleHash, full_name, batch_year, course, industry, company, position, mentor_available, is_batch_leader]
    );
  }

  const adminId = (await pool.query(`SELECT id FROM users WHERE school_id = $1 AND email = 'admin@alumni.local'`, [ihesId])).rows[0].id;

  const existingEvents = await pool.query('SELECT COUNT(*)::int AS c FROM events WHERE school_id = $1', [ihesId]);
  if (existingEvents.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO events (school_id, title, description, location, event_date, created_by) VALUES
       ($1, 'Homecoming 2025', 'Annual alumni homecoming', 'Main Gym', now() - interval '2 months', $2),
       ($1, 'Batch 2026 Reunion', 'Reconnect with your batch', 'Function Hall', now() + interval '1 month', $2)`,
      [ihesId, adminId]
    );
  }

  const existingJobs = await pool.query('SELECT COUNT(*)::int AS c FROM jobs WHERE school_id = $1', [ihesId]);
  if (existingJobs.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO jobs (school_id, title, company, location, description, job_type, is_referral, posted_by) VALUES
       ($1, 'Frontend Developer', 'Globex Inc', 'Remote', 'React experience needed', 'job', true, $2),
       ($1, 'Marketing Intern', 'BuildRight', 'Cebu City', 'Summer internship', 'internship', false, $2)`,
      [ihesId, adminId]
    );
  }

  const existingAnnouncements = await pool.query('SELECT COUNT(*)::int AS c FROM announcements WHERE school_id = $1', [ihesId]);
  if (existingAnnouncements.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO announcements (school_id, title, body, posted_by) VALUES
       ($1, 'Welcome to the new Alumni Portal', 'We are excited to launch this platform for our community.', $2)`,
      [ihesId, adminId]
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
