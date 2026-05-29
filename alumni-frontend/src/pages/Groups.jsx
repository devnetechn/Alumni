import { useEffect, useState } from 'react';
import { UsersRound, Plus, LogIn, LogOut, Send } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [posts, setPosts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', kind: 'interest' });
  const [postBody, setPostBody] = useState('');

  const loadGroups = async () => {
    const { data } = await api.get('/groups');
    setGroups(data.groups);
  };

  const open = async (g) => {
    setSelected(g);
    const { data } = await api.get(`/groups/${g.id}`);
    setDetail(data);
    const p = await api.get(`/groups/${g.id}/posts`);
    setPosts(p.data.posts);
  };

  const create = async () => {
    if (!form.name) return;
    await api.post('/groups', form);
    setForm({ name: '', description: '', kind: 'interest' });
    setShowCreate(false);
    loadGroups();
  };

  const join = async (id) => { await api.post(`/groups/${id}/join`); loadGroups(); if (selected?.id === id) open(selected); };
  const leave = async (id) => { await api.delete(`/groups/${id}/join`); loadGroups(); if (selected?.id === id) open(selected); };

  const post = async () => {
    if (!postBody.trim() || !selected) return;
    await api.post(`/groups/${selected.id}/posts`, { body: postBody });
    setPostBody('');
    const p = await api.get(`/groups/${selected.id}/posts`);
    setPosts(p.data.posts);
  };

  useEffect(() => { loadGroups(); }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <UsersRound className="text-indigo-600" /> Groups
          </h1>
          <p className="text-slate-500 mt-1">Batch, course, interest & mentorship communities</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold">
          <Plus size={16} /> New Group
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 mb-6 grid md:grid-cols-4 gap-3">
          <input className="border border-slate-300 rounded-lg px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border border-slate-300 rounded-lg px-3 py-2 md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="border border-slate-300 rounded-lg px-3 py-2" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="interest">Interest</option>
            <option value="batch">Batch</option>
            <option value="course">Course</option>
            <option value="mentorship">Mentorship</option>
          </select>
          <button onClick={create} className="bg-slate-900 text-white rounded-lg px-4 py-2 md:col-span-4">Create</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-3">
          {groups.length === 0 && <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-500">No groups yet.</div>}
          {groups.map((g) => (
            <div key={g.id} onClick={() => open(g)} className={`cursor-pointer bg-white p-4 rounded-2xl border transition-all ${selected?.id === g.id ? 'border-indigo-500 shadow' : 'border-slate-200 hover:border-indigo-300'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">{g.name}</h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{g.kind}</span>
              </div>
              {g.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>}
              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>{g.member_count} members</span>
                {user && (g.is_member ? (
                  <button onClick={(e) => { e.stopPropagation(); leave(g.id); }} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><LogOut size={12} /> Leave</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); join(g.id); }} className="inline-flex items-center gap-1 text-indigo-600 hover:underline"><LogIn size={12} /> Join</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selected && <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">Select a group to view posts.</div>}
          {selected && detail && (
            <div className="bg-white rounded-2xl border border-slate-200">
              <div className="p-5 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-900">{detail.group.name}</h2>
                <p className="text-sm text-slate-500">{detail.members.length} members · {detail.group.kind}</p>
              </div>
              {detail.isMember && (
                <div className="p-5 border-b border-slate-200 flex gap-2">
                  <input className="flex-1 border border-slate-300 rounded-lg px-3 py-2" placeholder="Share something with the group..." value={postBody} onChange={(e) => setPostBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} />
                  <button onClick={post} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-lg"><Send size={16} /></button>
                </div>
              )}
              <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto">
                {posts.length === 0 && <p className="text-slate-500 text-center">No posts yet.</p>}
                {posts.map((p) => (
                  <div key={p.id} className="border-l-2 border-indigo-300 pl-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900">{p.author_name || p.author_email}</span>
                      <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
