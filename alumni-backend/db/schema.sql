DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alumni_app') THEN
    CREATE ROLE alumni_app LOGIN PASSWORD 'alumni_app_dev';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  plan TEXT NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'alumni' CHECK (role IN ('admin','alumni')),
  active BOOLEAN NOT NULL DEFAULT true,
  is_batch_leader BOOLEAN NOT NULL DEFAULT false,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  full_name TEXT,
  batch_year INTEGER,
  course TEXT,
  contact TEXT,
  address TEXT,
  company TEXT,
  position TEXT,
  industry TEXT,
  bio TEXT,
  profile_pic TEXT,
  mentor_available BOOLEAN NOT NULL DEFAULT false,
  nfc_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, email)
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going','maybe','not_going')),
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_checkins (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_in_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  description TEXT,
  job_type TEXT NOT NULL DEFAULT 'job' CHECK (job_type IN ('job','internship')),
  is_referral BOOLEAN NOT NULL DEFAULT false,
  posted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  posted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'interest' CHECK (kind IN ('interest','batch','course','mentorship')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_posts (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE event_checkins ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE group_posts ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON events;
CREATE POLICY tenant_isolation ON events
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON event_rsvps;
CREATE POLICY tenant_isolation ON event_rsvps
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON event_checkins;
CREATE POLICY tenant_isolation ON event_checkins
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON jobs;
CREATE POLICY tenant_isolation ON jobs
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON announcements;
CREATE POLICY tenant_isolation ON announcements
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON messages;
CREATE POLICY tenant_isolation ON messages
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON groups;
CREATE POLICY tenant_isolation ON groups
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON group_members;
CREATE POLICY tenant_isolation ON group_members
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON group_posts;
CREATE POLICY tenant_isolation ON group_posts
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

GRANT ALL ON ALL TABLES IN SCHEMA public TO alumni_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO alumni_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO alumni_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO alumni_app;
