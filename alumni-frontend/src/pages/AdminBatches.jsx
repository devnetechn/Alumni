import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Input } from '../components/ui';
import { Empty, Loading } from '../components/PageHeader';
import { Field, FormAlert } from '../components/layout/AuthSplit';

const TABS = [['batches', 'Batches & presidents'], ['requests', 'Membership oversight'], ['audit', 'Audit log'], ['settings', 'Association settings']];

function BatchesTab() {
  const [batches, setBatches] = useState(null);
  const [users, setUsers] = useState([]);
  const [unlisted, setUnlisted] = useState([]);
  const [year, setYear] = useState('');
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const [creating, setCreating] = useState(null);
  const [acct, setAcct] = useState({ full_name: '', email: '', password: '' });

  const load = () => {
    api.get('/batches').then((r) => setBatches(r.data.batches));
    api.get('/batches/admin/unlisted').then((r) => setUnlisted(r.data.unlisted)).catch(() => {});
  };
  useEffect(() => { load(); api.get('/admin/users').then((r) => setUsers(r.data.users.filter((u) => u.active && u.role !== 'admin' && u.member_type !== 'guest'))); }, []);

  const create = async (e, y = year) => {
    e?.preventDefault();
    try { await api.post('/batches', { year: y }); setYear(''); setMsg({ error: '', ok: `Batch ${y} created.` }); load(); }
    catch (err) { setMsg({ error: err.response?.data?.error || 'Could not create batch.', ok: '' }); }
  };

  const assign = async (batch, userId) => {
    if (!userId) return;
    try { await api.put(`/batches/${batch.id}/president`, { user_id: userId }); setMsg({ error: '', ok: `President assigned to ${batch.name}.` }); load(); }
    catch (err) { setMsg({ error: err.response?.data?.error || 'Could not assign president.', ok: '' }); }
  };

  const createAccount = async (e) => {
    e.preventDefault();
    const batch = batches.find((b) => b.id === creating);
    try {
      await api.post(`/batches/${batch.id}/president-account`, acct);
      setMsg({ error: '', ok: `Account created for ${acct.full_name}. They are now president of ${batch.name}. Share the email and password with them.` });
      setCreating(null); setAcct({ full_name: '', email: '', password: '' });
      load(); api.get('/admin/users').then((r) => setUsers(r.data.users.filter((u) => u.active && u.role !== 'admin' && u.member_type !== 'guest')));
    } catch (err) { setMsg({ error: err.response?.data?.error || 'Could not create the account.', ok: '' }); }
  };

  return (
    <div className="space-y-6">
      <FormAlert>{msg.error}</FormAlert>
      <FormAlert tone="ok">{msg.ok}</FormAlert>
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <Field label="Create a batch" id="new-year"><Input id="new-year" inputMode="numeric" maxLength={4} placeholder="Graduation year, e.g. 2018" value={year} onChange={(e) => setYear(e.target.value)} required /></Field>
        <Button type="submit" variant="navy">Create batch</Button>
      </form>
      {unlisted.length > 0 && (
        <div className="border-l-2 border-[var(--gold)] pl-4">
          <p className="text-sm font-semibold text-[var(--navy)]">Registrants asked for batches that do not exist</p>
          <ul className="mt-2 flex flex-wrap gap-2">{unlisted.map((u) => <li key={u.year}><Button variant="secondary" className="!py-1.5" onClick={() => create(null, u.year)}>Create {u.year} ({u.applicants})</Button></li>)}</ul>
        </div>
      )}
      {batches === null ? <Loading /> : batches.length === 0 ? <Empty title="No batches yet">Create the first graduating batch above.</Empty> : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead><tr className="text-left bg-[var(--paper-2)] text-[var(--muted)]"><th className="p-3">Batch</th><th className="p-3">Members</th><th className="p-3">President</th><th className="p-3">Assign president</th><th className="p-3">New account</th></tr></thead>
            <tbody>{batches.map((b) => (
              <Fragment key={b.id}>
              <tr className="border-t border-[var(--line)]">
                <td className="p-3 font-semibold"><Link to={`/batches/${b.id}`} className="text-[var(--navy)] underline decoration-[var(--gold)]">{b.name}</Link></td>
                <td className="p-3">{b.member_count}</td>
                <td className="p-3">{b.president_name || <span className="text-[var(--muted)]">None</span>}</td>
                <td className="p-3">
                  <label className="sr-only" htmlFor={`pres-${b.id}`}>Assign president for {b.name}</label>
                  <Input as="select" id={`pres-${b.id}`} className="!w-56" value="" onChange={(e) => assign(b, e.target.value)}>
                    <option value="">Select a person…</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}{u.batch_year ? ` (${u.batch_year})` : ''}</option>)}
                  </Input>
                </td>
                <td className="p-3">
                  <Button variant="secondary" className="!py-1.5" onClick={() => { setCreating(creating === b.id ? null : b.id); setAcct({ full_name: '', email: '', password: '' }); }}>
                    {creating === b.id ? 'Cancel' : 'Create account'}
                  </Button>
                </td>
              </tr>
              {creating === b.id && (
                <tr className="bg-[var(--paper-2)]">
                  <td colSpan={5} className="p-4">
                    <form onSubmit={createAccount} className="flex flex-wrap items-end gap-3">
                      <Field label="Full name" id={`acct-name-${b.id}`}><Input id={`acct-name-${b.id}`} value={acct.full_name} onChange={(e) => setAcct({ ...acct, full_name: e.target.value })} required /></Field>
                      <Field label="Email" id={`acct-email-${b.id}`}><Input id={`acct-email-${b.id}`} type="email" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} required /></Field>
                      <Field label="Password (min 8 characters)" id={`acct-pass-${b.id}`}><Input id={`acct-pass-${b.id}`} type="text" minLength={8} value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} required /></Field>
                      <Button type="submit" variant="navy">Create &amp; make president of {b.name}</Button>
                    </form>
                    {b.president_name && <p className="text-xs text-[var(--muted)] mt-2">{b.president_name} will be replaced as president (they stay a member).</p>}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RequestsTab() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); api.get('/batches/admin/requests', { params: { status } }).then((r) => setRows(r.data.requests)); }, [status]);
  const tone = { pending: 'warning', approved: 'success', rejected: 'danger' };
  return (
    <div className="space-y-4">
      <Input as="select" aria-label="Filter by status" className="!w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
      </Input>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty title="No requests" /> : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead><tr className="text-left bg-[var(--paper-2)] text-[var(--muted)]"><th className="p-3">Applicant</th><th className="p-3">Batch</th><th className="p-3">Status</th><th className="p-3">Requested</th><th className="p-3">Decided by</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)]">
                <td className="p-3"><p className="font-semibold text-[var(--navy)]">{r.full_name || '—'}</p><p className="text-xs text-[var(--muted)]">{r.email}</p></td>
                <td className="p-3">{r.batch_year}</td>
                <td className="p-3"><Badge tone={tone[r.status]}>{r.status}</Badge></td>
                <td className="p-3">{new Date(r.requested_at).toLocaleDateString()}</td>
                <td className="p-3">{r.decided_by_name || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[var(--muted)]">Decisions are made by each batch president, or by you from the <Link to="/president" className="underline">batch dashboard</Link>.</p>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState(null);
  useEffect(() => { api.get('/batches/admin/audit').then((r) => setLogs(r.data.logs)); }, []);
  if (logs === null) return <Loading />;
  if (logs.length === 0) return <Empty title="No activity recorded yet" />;
  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-sm">
        <thead><tr className="text-left bg-[var(--paper-2)] text-[var(--muted)]"><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Details</th></tr></thead>
        <tbody>{logs.map((l) => (
          <tr key={l.id} className="border-t border-[var(--line)] align-top">
            <td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
            <td className="p-3">{l.actor_name || 'Unknown'}</td>
            <td className="p-3 font-mono text-xs">{l.action}</td>
            <td className="p-3 text-xs text-[var(--muted)] break-all">{l.entity}{l.entity_id ? ` #${l.entity_id}` : ''} {l.meta ? JSON.stringify(l.meta) : ''}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  const { school, refreshSchool } = useAuth();
  const [f, setF] = useState({ about: '', contact_email: '', contact_phone: '', contact_address: '', facebook_url: '' });
  const [msg, setMsg] = useState({ error: '', ok: '' });
  useEffect(() => { if (school) setF({ about: school.about || '', contact_email: school.contact_email || '', contact_phone: school.contact_phone || '', contact_address: school.contact_address || '', facebook_url: school.facebook_url || '' }); }, [school]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try { await api.patch('/school', f); await refreshSchool(); setMsg({ error: '', ok: 'Saved.' }); }
    catch (err) { setMsg({ error: err.response?.data?.error || 'Could not save.', ok: '' }); }
  };
  return (
    <form onSubmit={save} className="card p-6 space-y-4 max-w-2xl">
      <FormAlert>{msg.error}</FormAlert>
      <FormAlert tone="ok">{msg.ok}</FormAlert>
      <Field label="About the association" id="s-about"><Input as="textarea" id="s-about" rows={4} value={f.about} onChange={set('about')} /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Contact email" id="s-email"><Input id="s-email" type="email" value={f.contact_email} onChange={set('contact_email')} /></Field>
        <Field label="Contact phone" id="s-phone"><Input id="s-phone" value={f.contact_phone} onChange={set('contact_phone')} /></Field>
      </div>
      <Field label="Address" id="s-addr"><Input id="s-addr" value={f.contact_address} onChange={set('contact_address')} /></Field>
      <Field label="Facebook page URL" id="s-fb"><Input id="s-fb" type="url" value={f.facebook_url} onChange={set('facebook_url')} /></Field>
      <Button type="submit" variant="navy">Save settings</Button>
    </form>
  );
}

export default function AdminBatches() {
  const [tab, setTab] = useState('batches');
  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <p className="eyebrow mb-2">Administration</p>
      <h1 className="serif text-3xl text-[var(--navy)]">Batches &amp; oversight</h1>
      <span className="gold-rule mt-4" />
      <div role="tablist" aria-label="Admin sections" className="flex gap-1 mt-8 border-b border-[var(--line)] overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-[var(--gold)] text-[var(--navy)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--navy)]'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'batches' && <BatchesTab />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
