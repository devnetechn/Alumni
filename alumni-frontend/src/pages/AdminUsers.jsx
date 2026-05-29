import { useEffect, useState } from 'react';
import { Shield, UserX, UserCheck, Trash2, Crown, Star } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';

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
    return <div className="p-8 text-red-600">Admin access required.</div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="text-indigo-600" size={28} />
          User Management
        </h1>
        <p className="text-slate-500 mt-1">Manage alumni accounts, roles, and membership status</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="py-3 px-6 text-left font-semibold">User</th>
              <th className="py-3 px-6 text-left font-semibold">Batch</th>
              <th className="py-3 px-6 text-left font-semibold">Role</th>
              <th className="py-3 px-6 text-left font-semibold">Status</th>
              <th className="py-3 px-6 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {(u.full_name || u.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{u.full_name || '(No profile)'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-6 text-slate-600">
                  {u.batch_year || '—'}
                  {u.is_batch_leader && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold">
                      <Star size={10} /> Leader
                    </span>
                  )}
                </td>
                <td className="py-3 px-6">
                  {u.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">
                      <Crown size={12} /> Admin
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full font-bold">Alumni</span>
                  )}
                </td>
                <td className="py-3 px-6">
                  {u.active ? (
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-bold">Active</span>
                  ) : (
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">Inactive</span>
                  )}
                </td>
                <td className="py-3 px-6 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => toggleRole(u)} title="Toggle admin" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                      <Crown size={16} />
                    </button>
                    <button onClick={() => toggleActive(u)} title="Toggle active" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                      {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    <button onClick={() => toggleLeader(u)} title="Toggle batch leader" className={`p-2 hover:bg-slate-100 rounded-lg ${u.is_batch_leader ? 'text-yellow-600' : 'text-slate-600'}`}>
                      <Star size={16} />
                    </button>
                    {u.id !== me.id && (
                      <button onClick={() => remove(u)} title="Delete" className="p-2 hover:bg-red-50 rounded-lg text-red-600">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
