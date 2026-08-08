import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Power, CreditCard, Clock, Trash2, LogOut } from 'lucide-react';
import { platformApi } from '../api';
import { Panel, Button, Badge, Input, Wordmark } from '../components/ui';

export default function PlatformDashboard() {
  const nav = useNavigate();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [deleteErr, setDeleteErr] = useState('');

  const load = () => {
    setLoading(true);
    platformApi.get('/schools').then((r) => setSchools(r.data.schools)).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!localStorage.getItem('platform_token')) {
      nav('/platform/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (school) => {
    await platformApi.patch(`/schools/${school.id}`, { active: !school.active });
    load();
  };

  const markActive = async (school) => {
    await platformApi.patch(`/schools/${school.id}`, { plan: 'active' });
    load();
  };

  const extendTrial = async (school) => {
    await platformApi.patch(`/schools/${school.id}`, { extendTrialDays: 30 });
    load();
  };

  const confirmDelete = async () => {
    setDeleteErr('');
    try {
      await platformApi.delete(`/schools/${deleteTarget.id}`, { data: { confirmSlug } });
      setDeleteTarget(null);
      setConfirmSlug('');
      load();
    } catch (e) {
      setDeleteErr(e.response?.data?.error || 'Delete failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('platform_token');
    nav('/platform/login');
  };

  const statusFor = (s) => {
    if (!s.active) return { label: 'Inactive', tone: 'danger' };
    if (s.plan === 'active') return { label: 'Active', tone: 'success' };
    if (new Date(s.trial_ends_at) < new Date()) return { label: 'Trial Expired', tone: 'danger' };
    return { label: 'Trialing', tone: 'warning' };
  };

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <Shield className="text-white" size={22} />
            </div>
            <div>
              <Wordmark />
              <p className="text-xs text-slate-500 leading-tight">Platform Admin</p>
            </div>
          </div>
          <Button variant="secondary" onClick={logout}>
            <LogOut size={16} /> Logout
          </Button>
        </div>

        <Panel className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading schools...</div>
          ) : schools.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No schools yet.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-[2.5px] border-[var(--brand-ink)] text-[var(--brand-ink)] text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 text-left font-bold">School</th>
                  <th className="py-3 px-4 text-left font-bold">Status</th>
                  <th className="py-3 px-4 text-left font-bold">Alumni</th>
                  <th className="py-3 px-4 text-left font-bold">Events</th>
                  <th className="py-3 px-4 text-left font-bold">Trial Ends</th>
                  <th className="py-3 px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => {
                  const status = statusFor(s);
                  return (
                    <tr key={s.id} className="border-t border-slate-200">
                      <td className="py-3 px-4">
                        <p className="font-bold text-[var(--brand-ink)]">{s.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{s.slug}</p>
                      </td>
                      <td className="py-3 px-4"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td className="py-3 px-4 text-slate-600">{s.alumni_count}</td>
                      <td className="py-3 px-4 text-slate-600">{s.event_count}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{new Date(s.trial_ends_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button onClick={() => toggleActive(s)} title={s.active ? 'Deactivate' : 'Activate'} className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                            <Power size={16} />
                          </button>
                          {s.plan === 'trial' && (
                            <>
                              <button onClick={() => markActive(s)} title="Mark plan active" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                                <CreditCard size={16} />
                              </button>
                              <button onClick={() => extendTrial(s)} title="Extend trial 30 days" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                                <Clock size={16} />
                              </button>
                            </>
                          )}
                          <button onClick={() => { setDeleteTarget(s); setConfirmSlug(''); setDeleteErr(''); }} title="Delete school" className="p-2 border-2 border-transparent hover:border-[var(--brand-danger)] rounded-[var(--radius)] text-[var(--brand-danger)]">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </Panel>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <Panel className="max-w-md w-full p-6">
            <h2 className="font-display text-xl text-[var(--brand-ink)] mb-2">Delete {deleteTarget.name}?</h2>
            <p className="text-sm text-slate-600 mb-4">
              This permanently deletes the school and every alumni, event, job, and message that belongs to it. Type <span className="font-mono font-bold">{deleteTarget.slug}</span> to confirm.
            </p>
            {deleteErr && (
              <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-2 rounded-[var(--radius)] mb-3 text-xs">
                {deleteErr}
              </div>
            )}
            <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} placeholder={deleteTarget.slug} className="mb-4" />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" disabled={confirmSlug !== deleteTarget.slug} onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
