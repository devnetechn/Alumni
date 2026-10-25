const { queryForSchool } = require('../db');
const { notifyRequestSubmitted } = require('./batchAccess');
const { createNotification } = require('../routes/notifications');

// Turns a staged pending_signups row into a real user. Called by both the
// PayMongo webhook and the status poll (which asks PayMongo directly), so
// whichever sees the payment first wins and the other is a no-op: the unique
// (school_id, email) constraint rejects a second insert, and the pending row
// is gone once consumed.
async function fulfilPendingSignup(schoolId, sessionToken) {
  const pending = await queryForSchool(
    schoolId,
    `SELECT * FROM pending_signups WHERE session_token = $1`,
    [sessionToken]
  );
  if (pending.length === 0) return false;
  const signup = pending[0];

  let created;
  try {
    [created] = await queryForSchool(
      schoolId,
      `INSERT INTO users (school_id, email, password_hash, full_name, batch_year, contact, address, member_type, profile_pic, registration_paid_until, paymongo_checkout_session_id, course, requested_batch_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + interval '2 years', $10, $11, $12) RETURNING id`,
      [
        schoolId,
        signup.email,
        signup.password_hash,
        signup.full_name,
        signup.batch_year,
        signup.contact,
        signup.address,
        signup.member_type,
        signup.profile_pic,
        sessionToken,
        signup.course,
        signup.requested_batch_year,
      ]
    );
  } catch (err) {
    if (err.code === '23505') return false; // the other path already created this user
    throw err;
  }

  if (!signup.batch_id && signup.requested_batch_year) {
    const admins = await queryForSchool(schoolId, "SELECT id FROM users WHERE role = 'admin' AND active = true");
    for (const a of admins) {
      await createNotification((t, p) => queryForSchool(schoolId, t, p), { userId: a.id, type: 'membership', title: `Batch ${signup.requested_batch_year} requested`, body: `${signup.full_name || signup.email} registered for a batch that is not listed yet.`, link: '/admin/batches' });
    }
  }
  if (signup.batch_id) {
    const [batch] = await queryForSchool(schoolId, 'SELECT * FROM batches WHERE id = $1', [signup.batch_id]);
    if (batch) {
      await queryForSchool(schoolId, 'INSERT INTO batch_memberships (school_id, batch_id, user_id) VALUES ($1,$2,$3)', [schoolId, batch.id, created.id]);
      await notifyRequestSubmitted((t, p) => queryForSchool(schoolId, t, p), batch, { id: created.id, full_name: signup.full_name, email: signup.email });
    }
  }
  await queryForSchool(schoolId, `DELETE FROM pending_signups WHERE session_token = $1`, [sessionToken]);
  return true;
}

module.exports = { fulfilPendingSignup };
