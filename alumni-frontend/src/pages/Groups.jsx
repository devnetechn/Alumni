import { useEffect, useState } from 'react';
import { UsersRound, Plus, LogIn, LogOut, Send } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Input, Badge } from '../components/ui';

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
          <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
            <UsersRound className="text-[var(--brand-accent)]" /> Groups
          </h1>
          <p className="text-slate-500 mt-1">Batch, course, interest & mentorship communities</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus size={16} /> New Group
        </Button>
      </div>

      {showCreate && (
        <Panel className="p-5 mb-6 grid md:grid-cols-4 gap-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input className="md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input as="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="interest">Interest</option>
            <option value="batch">Batch</option>
            <option value="course">Course</option>
            <option value="mentorship">Mentorship</option>
          </Input>
          <Button className="md:col-span-4" onClick={create}>Create</Button>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-3">
          {groups.length === 0 && <Panel className="p-6 text-slate-500">No groups yet.</Panel>}
          {groups.map((g) => (
            <Panel
              key={g.id}
              onClick={() => open(g)}
              className={`cursor-pointer p-4 transition-all ${selected?.id === g.id ? 'shadow-[4px_4px_0_var(--brand-accent)] border-[var(--brand-accent)]' : ''}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--brand-ink)]">{g.name}</h3>
                <Badge tone="neutral" className="capitalize">{g.kind}</Badge>
              </div>
              {g.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>}
              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>{g.member_count} members</span>
                {user && (g.is_member ? (
                  <button onClick={(e) => { e.stopPropagation(); leave(g.id); }} className="inline-flex items-center gap-1 text-[var(--brand-danger)] hover:underline font-semibold"><LogOut size={12} /> Leave</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); join(g.id); }} className="inline-flex items-center gap-1 text-[var(--brand-accent)] hover:underline font-semibold"><LogIn size={12} /> Join</button>
                ))}
              </div>
            </Panel>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selected && <Panel className="p-8 text-center text-slate-500">Select a group to view posts.</Panel>}
          {selected && detail && (
            <Panel>
              <div className="p-5 border-b-[2.5px] border-[var(--brand-ink)]">
                <h2 className="font-display text-xl text-[var(--brand-ink)]">{detail.group.name}</h2>
                <p className="text-sm text-slate-500">{detail.members.length} members · {detail.group.kind}</p>
              </div>
              {detail.isMember && (
                <div className="p-5 border-b border-slate-200 flex gap-2">
                  <Input placeholder="Share something with the group..." value={postBody} onChange={(e) => setPostBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} />
                  <Button onClick={post} className="px-4"><Send size={16} /></Button>
                </div>
              )}
              <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto">
                {posts.length === 0 && <p className="text-slate-500 text-center">No posts yet.</p>}
                {posts.map((p) => (
                  <div key={p.id} className="border-l-2 border-[var(--brand-accent)] pl-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[var(--brand-ink)]">{p.author_name || p.author_email}</span>
                      <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
