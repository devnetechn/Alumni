-- ===== Premium Alumni: batches, memberships, private communities =====

CREATE TABLE IF NOT EXISTS batches (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  name TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  president_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, year)
);

CREATE TABLE IF NOT EXISTS batch_memberships (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT,
  UNIQUE (user_id),
  UNIQUE (batch_id, user_id)
);

CREATE TABLE IF NOT EXISTS batch_posts (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post','announcement')),
  body TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (body IS NOT NULL OR image IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS batch_comments (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES batch_posts(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES batch_comments(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_likes (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES batch_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER CHECK (capacity IS NULL OR capacity > 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE events ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE;

ALTER TABLE users ADD COLUMN IF NOT EXISTS directory_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_location BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_batch_year INTEGER;

ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS batch_id INTEGER;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS course TEXT;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS requested_batch_year INTEGER;

CREATE INDEX IF NOT EXISTS batch_posts_batch_idx ON batch_posts (batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS batch_comments_post_idx ON batch_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS batch_memberships_batch_idx ON batch_memberships (batch_id, status);

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON batches;
CREATE POLICY tenant_isolation ON batches
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON batch_memberships;
CREATE POLICY tenant_isolation ON batch_memberships
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING (school_id = current_setting('app.school_id', true)::int)
  WITH CHECK (school_id = current_setting('app.school_id', true)::int);

-- Private community content is gated at the database layer too: besides the
-- tenant check, a row is only visible/writable to a super admin or to a user
-- with an *approved* membership in that row's batch. The app sets
-- app.user_id / app.is_admin per request (see queryForSchool in src/db.js).
DROP POLICY IF EXISTS batch_member_access ON batch_posts;
CREATE POLICY batch_member_access ON batch_posts
  USING (
    school_id = current_setting('app.school_id', true)::int
    AND (
      current_setting('app.is_admin', true) = 'true'
      OR EXISTS (SELECT 1 FROM batch_memberships m
                 WHERE m.batch_id = batch_posts.batch_id
                   AND m.user_id = nullif(current_setting('app.user_id', true), '')::int
                   AND m.status = 'approved')
    )
  )
  WITH CHECK (
    school_id = current_setting('app.school_id', true)::int
    AND (
      current_setting('app.is_admin', true) = 'true'
      OR EXISTS (SELECT 1 FROM batch_memberships m
                 WHERE m.batch_id = batch_posts.batch_id
                   AND m.user_id = nullif(current_setting('app.user_id', true), '')::int
                   AND m.status = 'approved')
    )
  );

DROP POLICY IF EXISTS batch_member_access ON batch_comments;
CREATE POLICY batch_member_access ON batch_comments
  USING (
    school_id = current_setting('app.school_id', true)::int
    AND (
      current_setting('app.is_admin', true) = 'true'
      OR EXISTS (SELECT 1 FROM batch_memberships m
                 WHERE m.batch_id = batch_comments.batch_id
                   AND m.user_id = nullif(current_setting('app.user_id', true), '')::int
                   AND m.status = 'approved')
    )
  )
  WITH CHECK (
    school_id = current_setting('app.school_id', true)::int
    AND (
      current_setting('app.is_admin', true) = 'true'
      OR EXISTS (SELECT 1 FROM batch_memberships m
                 WHERE m.batch_id = batch_comments.batch_id
                   AND m.user_id = nullif(current_setting('app.user_id', true), '')::int
                   AND m.status = 'approved')
    )
  );

DROP POLICY IF EXISTS batch_member_access ON batch_likes;
CREATE POLICY batch_member_access ON batch_likes
  USING (
    school_id = current_setting('app.school_id', true)::int
    AND (
      current_setting('app.is_admin', true) = 'true'
      OR EXISTS (SELECT 1 FROM batch_memberships m
                 WHERE m.batch_id = batch_likes.batch_id
                   AND m.user_id = nullif(current_setting('app.user_id', true), '')::int
                   AND m.status = 'approved')
    )
  )
  WITH CHECK (
    school_id = current_setting('app.school_id', true)::int
    AND (
      current_setting('app.is_admin', true) = 'true'
      OR EXISTS (SELECT 1 FROM batch_memberships m
                 WHERE m.batch_id = batch_likes.batch_id
                   AND m.user_id = nullif(current_setting('app.user_id', true), '')::int
                   AND m.status = 'approved')
    )
  );

GRANT ALL ON batches, batch_memberships, batch_posts, batch_comments, batch_likes, audit_logs TO alumni_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO alumni_app;
GRANT SELECT ON batches, batch_memberships, batch_posts, batch_comments, batch_likes, audit_logs TO alumni_platform;

ALTER TABLE schools ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_address TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS facebook_url TEXT;
