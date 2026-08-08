import { useEffect, useState } from 'react';
import { Shield, UserX, UserCheck, Trash2, Crown, Star } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Badge, Avatar } from '../components/ui';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);

  const load = () => api.get('/admin/users').then((r) => setUsers(r.data.users));
  useEffect(() => { load(); }, []);

  const toggleRole = async (u) => {
    await api.put(`/admin/users/${u.id}`, { role: u.role === 'admin' ? 'alumni' : 'admin' });
    load();
  };

  const toggleActive = async (u) => {
    await api.put(`/admin/users/${u.id}`, { active: !u.active });
    load();
  };

  const toggleLeader = async (u) => {
    await api.put(`/admin/users/${u.id}`, { is_batch_leader: !u.is_batch_leader });
    load();
  };

  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}?`)) return;
    await api.delete(`/admin/users/${u.id}`);
    load();
  };

  if (me?.role !== 'admin') {
    return <div className="p-8 text-[var(--brand-danger)] font-semibold">Admin access required.</div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Shield className="text-[var(--brand-accent)]" size={28} />
          User Management
        </h1>
        <p className="text-slate-500 mt-1">Manage alumni accounts, roles, and membership status</p>
      </div>

      <Panel className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-[2.5px] border-[var(--brand-ink)] text-[var(--brand-ink)] text-xs uppercase tracking-wider">
              <th className="py-3 px-6 text-left font-bold">User</th>
              <th className="py-3 px-6 text-left font-bold">Batch</th>
              <th className="py-3 px-6 text-left font-bold">Role</th>
              <th className="py-3 px-6 text-left font-bold">Status</th>
              <th className="py-3 px-6 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-200 hover:bg-[var(--brand-surface)]">
                <td className="py-3 px-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.full_name} email={u.email} size="md" />
                    <div>
                      <p className="font-bold text-[var(--brand-ink)]">{u.full_name || '(No profile)'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-6 text-slate-600">
                  {u.batch_year || '—'}
                  {u.is_batch_leader && (
                    <Badge tone="warning" className="ml-2"><Star size={10} /> Leader</Badge>
                  )}
                </td>
                <td className="py-3 px-6">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {u.role === 'admin' ? (
                      <Badge tone="accent"><Crown size={12} /> Admin</Badge>
                    ) : (
                      <Badge tone="neutral">Alumni</Badge>
                    )}
                    <Badge tone={u.member_type === 'guest' ? 'warning' : 'neutral'}>
                      {u.member_type === 'guest' ? 'Guest' : 'Alumnus'}
                    </Badge>
                  </div>
                </td>
                <td className="py-3 px-6">
                  {u.active ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="danger">Inactive</Badge>
                  )}
                </td>
                <td className="py-3 px-6 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => toggleRole(u)} title="Toggle admin" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                      <Crown size={16} />
                    </button>
                    <button onClick={() => toggleActive(u)} title="Toggle active" className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
                      {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    <button
                      onClick={() => toggleLeader(u)}
                      disabled={u.member_type === 'guest'}
                      title={u.member_type === 'guest' ? 'Guests cannot be batch leaders' : 'Toggle batch leader'}
                      className={`p-2 border-2 border-transparent rounded-[var(--radius)] ${
                        u.member_type === 'guest'
                          ? 'text-slate-300 cursor-not-allowed'
                          : `hover:border-[var(--brand-ink)] ${u.is_batch_leader ? 'text-[#b8860b]' : 'text-[var(--brand-ink)]'}`
                      }`}
                    >
                      <Star size={16} />
                    </button>
                    {u.id !== me.id && (
                      <button onClick={() => remove(u)} title="Delete" className="p-2 border-2 border-transparent hover:border-[var(--brand-danger)] rounded-[var(--radius)] text-[var(--brand-danger)]">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
