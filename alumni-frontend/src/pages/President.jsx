import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Users, Inbox, History, Megaphone } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Badge, Button, Input, StatTile } from '../components/ui';
import { Empty, Loading } from '../components/PageHeader';
import { FormAlert } from '../components/layout/AuthSplit';
import ConfirmDialog from '../components/ConfirmDialog';
import Composer from '../components/community/Composer';

const TABS = [['requests', 'Pending requests', Inbox], ['history', 'Processed', History], ['members', 'Members', Users], ['announce', 'Announcements', Megaphone]];

export default function President() {
  const { user, managedBatches, refresh } = useAuth();
  const [allBatches, setAllBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState(null);
  const [tab, setTab] = useState('requests');
  const [rows, setRows] = useState(null);
  const [members, setMembers] = useState(null);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg] = useState({ error: '', ok: '' });

  const isAdmin = user.role === 'admin';
  const choices = isAdmin ? allBatches : managedBatches;

  const [batchesLoaded, setBatchesLoaded] = useState(!isAdmin);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/batches')
      .then((r) => setAllBatches(r.data.batches))
      .catch((e) => setMsg({ error: e.response?.data?.error || 'Could not load batches.', ok: '' }))
      .finally(() => setBatchesLoaded(true));
  }, [isAdmin]);
  useEffect(() => { if (!batchId && choices.length) setBatchId(String(choices[0].id)); }, [choices, batchId]);

  const loadBatch = useCallback(() => batchId && api.get(`/batches/${batchId}`).then((r) => setBatch(r.data.batch)), [batchId]);
  useEffect(() => { loadBatch(); }, [loadBatch]);

  const loadRows = useCallback(async () => {
    if (!batchId) return;
    setRows(null);
    try {
      if (tab === 'requests' || tab === 'history') {
        const { data } = await api.get(`/batches/${batchId}/requests`, { params: { status: tab === 'history' ? 'processed' : 'pending' } });
        setRows(data.requests);
        if (tab === 'requests') setPendingCount(data.requests.length);
      } else if (tab === 'members') {
        const { data } = await api.get(`/batches/${batchId}/members`, { params: { search: search || undefined } });
        setMembers(data.members);
      }
    } catch (e) { setMsg({ error: e.response?.data?.error || 'Could not load data.', ok: '' }); }
  }, [batchId, tab, search]);
  useEffect(() => { const t = setTimeout(loadRows, tab === 'members' ? 200 : 0); return () => clearTimeout(t); }, [loadRows, tab]);

  const decide = (req, decision) => setConfirm({ req, decision });
  const doDecide = async (note) => {
    const { req, decision } = confirm;
    try {
      await api.post(`/batches/${batchId}/requests/${req.id}/decision`, { decision, note: note || undefined });
      setMsg({ error: '', ok: `${req.full_name || req.email} was ${decision}.` });
      setConfirm(null);
      loadRows(); loadBatch(); refresh();
    } catch (e) {
      setConfirm(null);
      setMsg({ error: e.response?.data?.error || 'Could not record the decision.', ok: '' });
      loadRows();
    }
  };

  const removeMember = async (m) => {
    if (!window.confirm(`Remove ${m.full_name} from the batch? They lose access to the private community.`)) return;
    try { await api.delete(`/batches/${batchId}/members/${m.id}`); loadRows(); loadBatch(); }
    catch (e) { setMsg({ error: e.response?.data?.error || 'Could not remove member.', ok: '' }); }
  };

  if (isAdmin && !batchesLoaded) return <Loading />;

  if (choices.length === 0 && isAdmin) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <Empty title="No batches yet">Create the graduating batches first, then manage their members and requests here. <Link to="/admin/batches" className="underline">Go to Batches &amp; oversight</Link>.</Empty>
      </div>
    );
  }

  if (choices.length === 0) {
    return <div className="p-6 lg:p-10 max-w-2xl mx-auto"><Empty title="No batch assigned">You are not the president of any batch. Ask the association administrator to assign you.</Empty></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <p className="eyebrow mb-2">{isAdmin ? 'Administrator view' : 'Batch president'}</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="serif text-3xl text-[var(--navy)]">{batch ? batch.name : 'Batch dashboard'}</h1>
        <div className="flex items-center gap-3">
          {choices.length > 1 && (
            <>
              <label htmlFor="batch-pick" className="sr-only">Select batch</label>
              <Input as="select" id="batch-pick" className="!w-auto" value={batchId} onChange={(e) => { setBatchId(e.target.value); setRows(null); }}>
                {choices.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Input>
            </>
          )}
          {batchId && <Link to={`/batches/${batchId}/community`}><Button variant="secondary">Open community</Button></Link>}
        </div>
      </div>
      <span className="gold-rule mt-4" />

      {batch && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
          <StatTile label="Approved members" value={batch.member_count} icon={Users} />
          <StatTile label="Pending requests" value={tab === 'requests' && rows ? rows.length : pendingCount} icon={Inbox} />
          <StatTile label="Graduation year" value={batch.year} icon={History} />
        </div>
      )}

      <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 mt-10 border-b border-[var(--line)] overflow-x-auto">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setMsg({ error: '', ok: '' }); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === key ? 'border-[var(--gold)] text-[var(--navy)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--navy)]'}`}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <FormAlert>{msg.error}</FormAlert>
        <FormAlert tone="ok">{msg.ok}</FormAlert>

        {(tab === 'requests' || tab === 'history') && (rows === null ? <Loading /> : rows.length === 0 ? (
          <Empty title={tab === 'requests' ? 'No pending requests' : 'Nothing processed yet'}>{tab === 'requests' ? 'New membership requests for this batch will appear here.' : 'Approved and rejected requests are listed here.'}</Empty>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const mismatch = r.claimed_year && batch && r.claimed_year !== batch.year;
              return (
                <li key={r.id} className="card p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <Avatar name={r.full_name} pic={r.profile_pic} size="lg" className="!w-14 !h-14 !text-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--navy)]">{r.full_name || 'Unnamed applicant'}</p>
                    <p className="text-sm text-[var(--muted)] break-all">{r.email}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {r.course ? `${r.course} · ` : ''}Requested {new Date(r.requested_at).toLocaleDateString()}
                      {r.decided_at && ` · Decided ${new Date(r.decided_at).toLocaleDateString()}${r.decided_by_name ? ` by ${r.decided_by_name}` : ''}`}
                    </p>
                    {mismatch && <p className="text-xs text-[#8F1C12] mt-1">Profile lists a different graduation year ({r.claimed_year}). Verify before approving.</p>}
                    {r.decision_note && <p className="text-xs text-[var(--muted)] mt-1">Note: {r.decision_note}</p>}
                  </div>
                  {tab === 'requests' ? (
                    <div className="flex gap-2 shrink-0">
                      <Button onClick={() => decide(r, 'approved')}><Check size={16} aria-hidden="true" /> Approve</Button>
                      <Button variant="secondary" onClick={() => decide(r, 'rejected')}><X size={16} aria-hidden="true" /> Reject</Button>
                    </div>
                  ) : <Badge tone={r.status === 'approved' ? 'success' : 'danger'}>{r.status}</Badge>}
                </li>
              );
            })}
          </ul>
        ))}

        {tab === 'members' && (
          <>
            <label htmlFor="mem-search" className="sr-only">Search members</label>
            <Input id="mem-search" placeholder="Search approved members" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            {members === null ? <Loading /> : members.length === 0 ? <Empty title="No members found" /> : (
              <ul className="grid md:grid-cols-2 gap-3">
                {members.map((m) => (
                  <li key={m.id} className="card p-4 flex items-center gap-3">
                    <Avatar name={m.full_name} pic={m.profile_pic} />
                    <div className="min-w-0 flex-1"><p className="font-semibold text-[var(--navy)] truncate">{m.full_name}</p><p className="text-xs text-[var(--muted)]">{m.is_president ? 'President' : `Joined ${new Date(m.joined_at).toLocaleDateString()}`}</p></div>
                    {!m.is_president && <Button variant="ghost" className="!text-[var(--brand-danger)]" onClick={() => removeMember(m)}>Remove</Button>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'announce' && batchId && (
          <Composer key={batchId} batchId={batchId} me={user} kind="announcement" placeholder="Write an announcement. Every approved member is notified."
            onPosted={() => setMsg({ error: '', ok: 'Announcement published and members notified.' })} />
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.decision === 'approved' ? 'Approve this request?' : 'Reject this request?'}
          message={confirm.decision === 'approved'
            ? `${confirm.req.full_name || confirm.req.email} will gain access to the private ${batch?.name} community.`
            : `${confirm.req.full_name || confirm.req.email} will not receive access to the private community and will be notified.`}
          confirmLabel={confirm.decision === 'approved' ? 'Approve' : 'Reject'}
          tone={confirm.decision === 'approved' ? 'navy' : 'danger'}
          withNote={confirm.decision === 'rejected'}
          onConfirm={doDecide} onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
