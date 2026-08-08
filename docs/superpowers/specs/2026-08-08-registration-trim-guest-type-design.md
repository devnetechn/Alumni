# Registration Form Trim + Guest/Alumnus Member Type — Design

## Problem

The registration form asks for too many fields up front (Full Name, Email,
Password, Batch Year, Course, Contact, Company, Position, Industry),
creating friction at signup. All the optional professional/academic
fields are already editable later via the Profile page, so they don't
need to be collected at registration time.

Separately, the community includes people who aren't graduates (e.g.
spouses, friends, industry partners) but should still be able to join,
attend, and pay for events like alumni — they just shouldn't be eligible
to become batch leaders. There's currently no way to distinguish these
"Guest" accounts from actual "Alumnus" accounts.

## Scope

Full-stack: one new DB column, one backend route change (register), one
backend route restriction (admin user update), two frontend page changes
(Register, AdminUsers).

## Design

### 1. Schema: `users.member_type`

```sql
ALTER TABLE users ADD COLUMN member_type TEXT NOT NULL DEFAULT 'alumnus'
  CHECK (member_type IN ('alumnus', 'guest'));
```

Kept **separate** from the existing `role` column (`'admin'`/`'alumni'`).
`role` already drives permission checks throughout the app
(`requireAdmin`, `requireOfficer` in `alumni-backend/src/middleware/auth.js`,
and the admin/alumni promote-demote toggle in `AdminUsers.jsx`). Folding a
third concept (membership type) into that column would conflict with
those existing assumptions. `member_type` is a purely orthogonal
attribute: an admin can be a guest or an alumnus; an alumni-role user can
be a guest or an alumnus.

### 2. Registration form (`alumni-frontend/src/pages/Register.jsx`)

Keep: Full Name, Email, Password, Batch Year, Contact, Address.
Remove from the form (still editable later via Profile): Course, Company,
Position, Industry.
Add: a "Guest / Alumnus" `<select>` (native select, no new UI primitive
needed — matches the existing plain `<Input>` styling pattern already
used by this form), defaulting to "Alumnus". Value posted as
`member_type: 'alumnus' | 'guest'`.

Address was already a column and already editable via `PUT /me`, but the
registration form and `POST /api/auth/register` never accepted it — adding
it to this form also closes that gap.

### 3. Backend: `POST /api/auth/register`

`alumni-backend/src/routes/auth.js` currently destructures
`{ email, password, full_name, batch_year, course, contact, company,
position, industry }` and never reads `address`. Add `address` and
`member_type` to the destructure and the INSERT. Validate `member_type`:
if present and not one of `'alumnus'`/`'guest'`, respond 400; if absent,
let the column default (`'alumnus'`) apply. Continue accepting the
existing optional fields (`course`, `company`, `position`, `industry`) for
backward compatibility — the frontend simply stops sending them, no need
to reject them if some other client sends them.

### 4. Guest can't be batch leader

**Backend** (`alumni-backend/src/routes/admin.js`, `PUT /users/:id`):
before applying updates, if the request sets `is_batch_leader: true`,
look up the target user's `member_type` (or use the value already being
set in the same request, if `member_type` is also present in the body)
and reject with 400 (`"Guests cannot be batch leaders"`) if it resolves to
`'guest'`.

**Frontend** (`alumni-frontend/src/pages/AdminUsers.jsx`): the existing
"Toggle batch leader" star button is disabled (with a `title` tooltip:
"Guests cannot be batch leaders") when `u.member_type === 'guest'`. Each
row also gets a small badge showing "Guest" or "Alumnus" next to the
existing Admin/Alumni role badge, using the same `Badge` component already
imported in that file.

## Out of scope

- No change to `Directory.jsx` — the user's requirements only covered
  registration and the admin user-management restriction.
- No restriction on paid-event RSVP for guests — confirmed explicitly:
  guests get the same event/payment access as alumni.
- No backfill migration needed beyond the `DEFAULT 'alumnus'` on the new
  column — existing rows get `'alumnus'` automatically.
