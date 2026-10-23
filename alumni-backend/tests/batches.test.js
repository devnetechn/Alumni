const request = require('supertest');
const { app } = require('../src/server');
const { pool, appPool, queryForSchool, query } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

async function makeBatch(year, presidentId = null) {
  const school = await getDefaultSchool();
  const rows = await query(
    'INSERT INTO batches (school_id, year, name, president_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [school.id, year, `Batch ${year}`, presidentId]
  );
  return rows[0];
}

let host;
beforeEach(async () => { host = hostFor(await getDefaultSchool()); });
const anon = (r) => r.set('Host', host);
const auth = (u) => ({ Authorization: authHeader(u) });

async function approvedMember(batch, overrides = {}) {
  const user = await insertUser({ batch_year: batch.year, ...overrides });
  await query(
    `INSERT INTO batch_memberships (school_id, batch_id, user_id, status) VALUES ($1,$2,$3,'approved')`,
    [user.school_id, batch.id, user.id]
  );
  return user;
}

test('registration with a batch creates a pending request and notifies the applicant and president', async () => {
  const president = await insertUser({ full_name: 'Pres' });
  const batch = await makeBatch(2018, president.id);
  const res = await anon(request(app).post('/api/auth/register')).send({
    email: 'new@test.com', password: 'longenough1', full_name: 'New Alum', batch_id: batch.id, course: 'BSIT',
  });
  expect(res.status).toBe(201);
  const m = await query('SELECT * FROM batch_memberships WHERE user_id = $1', [res.body.user.id]);
  expect(m[0].status).toBe('pending');
  expect(m[0].batch_id).toBe(batch.id);
  const own = await query('SELECT * FROM notifications WHERE user_id = $1', [res.body.user.id]);
  const pres = await query('SELECT * FROM notifications WHERE user_id = $1', [president.id]);
  expect(own.length).toBe(1);
  expect(pres.length).toBe(1);
});

test('registration validates input and requires a batch when batches exist', async () => {
  const batch = await makeBatch(2018);
  const noBatch = await anon(request(app).post('/api/auth/register')).send({ email: 'a@test.com', password: 'longenough1', full_name: 'A' });
  expect(noBatch.status).toBe(400);
  const badEmail = await anon(request(app).post('/api/auth/register')).send({ email: 'nope', password: 'longenough1', batch_id: batch.id });
  expect(badEmail.status).toBe(400);
  const short = await anon(request(app).post('/api/auth/register')).send({ email: 'b@test.com', password: 'short', batch_id: batch.id });
  expect(short.status).toBe(400);
  const missing = await anon(request(app).post('/api/auth/register')).send({ email: 'c@test.com', password: 'longenough1', batch_id: 9999 });
  expect(missing.status).toBe(400);
});

test('duplicate membership requests are rejected', async () => {
  const batch = await makeBatch(2018);
  const other = await makeBatch(2019);
  const user = await insertUser();
  const first = await request(app).post(`/api/batches/${batch.id}/join`).set(auth(user));
  expect(first.status).toBe(201);
  expect((await request(app).post(`/api/batches/${batch.id}/join`).set(auth(user))).status).toBe(409);
  expect((await request(app).post(`/api/batches/${other.id}/join`).set(auth(user))).status).toBe(409);
});

test('only the assigned president or an admin can approve; decisions are recorded and notified', async () => {
  const president = await insertUser();
  const otherPresident = await insertUser();
  const batch = await makeBatch(2018, president.id);
  await makeBatch(2019, otherPresident.id);
  const applicant = await insertUser();
  await request(app).post(`/api/batches/${batch.id}/join`).set(auth(applicant));
  const [m] = await query('SELECT * FROM batch_memberships WHERE user_id = $1', [applicant.id]);

  const url = `/api/batches/${batch.id}/requests/${m.id}/decision`;
  expect((await request(app).post(url).set(auth(applicant)).send({ decision: 'approved' })).status).toBe(403);
  expect((await request(app).post(url).set(auth(otherPresident)).send({ decision: 'approved' })).status).toBe(403);
  expect((await request(app).get(`/api/batches/${batch.id}/requests`).set(auth(otherPresident))).status).toBe(403);
  expect((await query('SELECT status FROM batch_memberships WHERE id = $1', [m.id]))[0].status).toBe('pending');

  const ok = await request(app).post(url).set(auth(president)).send({ decision: 'approved' });
  expect(ok.status).toBe(200);
  const [after] = await query('SELECT * FROM batch_memberships WHERE id = $1', [m.id]);
  expect(after.status).toBe('approved');
  expect(after.decided_by).toBe(president.id);
  expect(after.decided_at).not.toBeNull();
  expect((await request(app).post(url).set(auth(president)).send({ decision: 'rejected' })).status).toBe(409);
  const notes = await query(`SELECT * FROM notifications WHERE user_id = $1 AND title LIKE 'Welcome%'`, [applicant.id]);
  expect(notes.length).toBe(1);
  const audit = await query(`SELECT * FROM audit_logs WHERE action = 'membership.approved'`);
  expect(audit.length).toBe(1);
});

test('admin can decide any batch request', async () => {
  const admin = await insertUser({ role: 'admin' });
  const batch = await makeBatch(2018);
  const applicant = await insertUser();
  await request(app).post(`/api/batches/${batch.id}/join`).set(auth(applicant));
  const [m] = await query('SELECT * FROM batch_memberships WHERE user_id = $1', [applicant.id]);
  const res = await request(app).post(`/api/batches/${batch.id}/requests/${m.id}/decision`).set(auth(admin)).send({ decision: 'rejected', note: 'No record' });
  expect(res.status).toBe(200);
});

test('pending, rejected, outsider and other-batch users cannot read private batch content', async () => {
  const president = await insertUser();
  const batch = await makeBatch(2018, president.id);
  const other = await makeBatch(2019);
  const member = await approvedMember(batch);
  const pending = await insertUser();
  await request(app).post(`/api/batches/${batch.id}/join`).set(auth(pending));
  const rejected = await insertUser();
  await query(`INSERT INTO batch_memberships (school_id, batch_id, user_id, status) VALUES ($1,$2,$3,'rejected')`, [rejected.school_id, batch.id, rejected.id]);
  const otherMember = await approvedMember(other);
  const outsider = await insertUser();

  const post = await request(app).post(`/api/batches/${batch.id}/posts`).set(auth(member)).send({ body: 'Secret reunion plan' });
  expect(post.status).toBe(201);

  for (const user of [pending, rejected, otherMember, outsider]) {
    for (const path of ['posts', 'members', 'events', 'active']) {
      const res = await request(app).get(`/api/batches/${batch.id}/${path}`).set(auth(user));
      expect(res.status).toBe(403);
    }
    expect((await request(app).post(`/api/batches/${batch.id}/posts`).set(auth(user)).send({ body: 'hi' })).status).toBe(403);
    expect((await request(app).post(`/api/batches/${batch.id}/posts/${post.body.post.id}/like`).set(auth(user))).status).toBe(403);
    expect((await request(app).get(`/api/batches/${batch.id}/posts/${post.body.post.id}/comments`).set(auth(user))).status).toBe(403);
  }
  expect((await anon(request(app).get(`/api/batches/${batch.id}/posts`))).status).toBe(401);
  expect((await request(app).get(`/api/batches/${batch.id}/posts`).set(auth(member))).body.posts.length).toBe(1);
});

test('database RLS blocks batch posts for non-members even when queried directly', async () => {
  const batch = await makeBatch(2018);
  const member = await approvedMember(batch);
  const outsider = await insertUser();
  const school = await getDefaultSchool();
  await queryForSchool(school.id, 'INSERT INTO batch_posts (school_id, batch_id, author_id, body) VALUES ($1,$2,$3,$4)', [school.id, batch.id, member.id, 'x'], { id: member.id, role: 'alumni' });
  const asOutsider = await queryForSchool(school.id, 'SELECT * FROM batch_posts', [], { id: outsider.id, role: 'alumni' });
  expect(asOutsider.length).toBe(0);
  const noActor = await queryForSchool(school.id, 'SELECT * FROM batch_posts', []);
  expect(noActor.length).toBe(0);
  await expect(
    queryForSchool(school.id, 'INSERT INTO batch_posts (school_id, batch_id, author_id, body) VALUES ($1,$2,$3,$4)', [school.id, batch.id, outsider.id, 'sneak'], { id: outsider.id, role: 'alumni' })
  ).rejects.toThrow();
});

test('posts, likes and comments persist; announcements are president-only', async () => {
  const president = await insertUser({ full_name: 'Pres' });
  const batch = await makeBatch(2018, president.id);
  await query(`INSERT INTO batch_memberships (school_id, batch_id, user_id, status) VALUES ($1,$2,$3,'approved')`, [president.school_id, batch.id, president.id]);
  const member = await approvedMember(batch, { full_name: 'Mem' });

  const post = await request(app).post(`/api/batches/${batch.id}/posts`).set(auth(member)).send({ body: 'Hello batch' });
  const id = post.body.post.id;
  expect((await request(app).post(`/api/batches/${batch.id}/posts`).set(auth(member)).send({ body: 'x', kind: 'announcement' })).status).toBe(403);
  const ann = await request(app).post(`/api/batches/${batch.id}/posts`).set(auth(president)).send({ body: 'Reunion!', kind: 'announcement' });
  expect(ann.status).toBe(201);
  expect((await query(`SELECT * FROM notifications WHERE user_id = $1 AND type = 'announcement'`, [member.id])).length).toBe(1);

  const like = await request(app).post(`/api/batches/${batch.id}/posts/${id}/like`).set(auth(president));
  expect(like.body).toEqual({ liked: true, count: 1 });
  const unlike = await request(app).post(`/api/batches/${batch.id}/posts/${id}/like`).set(auth(president));
  expect(unlike.body).toEqual({ liked: false, count: 0 });

  const c1 = await request(app).post(`/api/batches/${batch.id}/posts/${id}/comments`).set(auth(president)).send({ body: 'Nice' });
  const c2 = await request(app).post(`/api/batches/${batch.id}/posts/${id}/comments`).set(auth(member)).send({ body: 'Thanks', parent_id: c1.body.comment.id });
  expect(c2.status).toBe(201);
  const list = await request(app).get(`/api/batches/${batch.id}/posts/${id}/comments`).set(auth(member));
  expect(list.body.comments.length).toBe(2);
  expect(list.body.comments[1].parent_id).toBe(c1.body.comment.id);
  expect((await query(`SELECT * FROM notifications WHERE user_id = $1 AND type = 'community'`, [member.id])).length).toBe(1);

  expect((await request(app).delete(`/api/batches/${batch.id}/posts/${id}`).set(auth(president))).status).toBe(204);
});

test('directory hides private fields and unapproved users; search and filters work', async () => {
  const batch = await makeBatch(2018);
  await approvedMember(batch, { full_name: 'Visible Vera', course: 'BSIT', address: 'Cebu' });
  await approvedMember(batch, { full_name: 'Hidden Hank', directory_visible: false });
  await insertUser({ full_name: 'Pending Pat' });
  const res = await anon(request(app).get('/api/directory'));
  expect(res.status).toBe(200);
  expect(res.body.alumni.map((a) => a.full_name)).toEqual(['Visible Vera']);
  expect(res.body.alumni[0]).not.toHaveProperty('email');
  expect(res.body.alumni[0]).not.toHaveProperty('contact');
  expect(res.body.alumni[0].location).toBeNull();
  expect((await anon(request(app).get('/api/directory?search=zzz'))).body.alumni.length).toBe(0);
  expect((await anon(request(app).get('/api/directory?year=2018&course=BSIT'))).body.alumni.length).toBe(1);
  expect((await anon(request(app).get('/api/directory?year=2001'))).body.alumni.length).toBe(0);
});

test('batch events are hidden from non-members; capacity and deadline are enforced', async () => {
  const president = await insertUser();
  const batch = await makeBatch(2018, president.id);
  const member = await approvedMember(batch);
  const outsider = await insertUser();
  const future = new Date(Date.now() + 7 * 864e5).toISOString();

  const created = await request(app).post('/api/events').set(auth(president)).send({ title: 'Batch dinner', event_date: future, batch_id: batch.id, capacity: 1 });
  expect(created.status).toBe(201);
  const otherCreate = await request(app).post('/api/events').set(auth(outsider)).send({ title: 'Nope', event_date: future, batch_id: batch.id });
  expect(otherCreate.status).toBe(403);

  const eid = created.body.event.id;
  expect((await anon(request(app).get('/api/events'))).body.events.length).toBe(0);
  expect((await request(app).get('/api/events').set(auth(member))).body.events.length).toBe(1);
  expect((await request(app).get(`/api/events/${eid}`).set(auth(outsider))).status).toBe(404);
  expect((await request(app).post(`/api/events/${eid}/rsvp`).set(auth(outsider)).send({ status: 'going' })).status).toBe(404);

  expect((await request(app).post(`/api/events/${eid}/rsvp`).set(auth(member)).send({ status: 'going' })).status).toBe(200);
  expect((await request(app).post(`/api/events/${eid}/rsvp`).set(auth(president)).send({ status: 'going' })).status).toBe(409);

  const closed = await request(app).post('/api/events').set(auth(president)).send({ title: 'Closed', event_date: future, batch_id: batch.id, registration_deadline: new Date(Date.now() - 1000).toISOString() });
  expect((await request(app).post(`/api/events/${closed.body.event.id}/rsvp`).set(auth(member)).send({ status: 'going' })).status).toBe(400);
});

test('admin creates a president account that is approved, assigned and not payment-gated', async () => {
  const admin = await insertUser({ role: 'admin' });
  const batch = await makeBatch(2018);
  const url = `/api/batches/${batch.id}/president-account`;
  const body = { full_name: 'New Pres', email: 'pres@test.com', password: 'longenough1' };

  const member = await insertUser();
  expect((await anon(request(app).post(url)).set(auth(member)).send(body)).status).toBe(403);
  expect((await anon(request(app).post(url)).set(auth(admin)).send({ ...body, password: 'short' })).status).toBe(400);

  const res = await anon(request(app).post(url)).set(auth(admin)).send(body);
  expect(res.status).toBe(201);
  const [b] = await query('SELECT president_id FROM batches WHERE id = $1', [batch.id]);
  expect(b.president_id).toBe(res.body.user.id);
  const [u] = await query('SELECT registration_paid_until, batch_year FROM users WHERE id = $1', [res.body.user.id]);
  expect(u.registration_paid_until).toBeNull();
  expect(u.batch_year).toBe(2018);
  const [m] = await query('SELECT status FROM batch_memberships WHERE user_id = $1', [res.body.user.id]);
  expect(m.status).toBe('approved');

  expect((await anon(request(app).post(url)).set(auth(admin)).send(body)).status).toBe(409);
  const login = await anon(request(app).post('/api/auth/login')).send({ email: body.email, password: body.password });
  expect(login.status).toBe(200);
});
