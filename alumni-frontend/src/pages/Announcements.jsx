import { useEffect, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import { Panel, Button, Input } from '../components/ui';

export default function Announcements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', body: '' });
  const [showForm, setShowForm] = useState(false);

  const load = () => api.get('/announcements').then((r) => setItems(r.data.announcements));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/announcements', form);
    setForm({ title: '', body: '' });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    await api.delete(`/announcements/${id}`);
    load();
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Announcements</h1>
          <p className="text-slate-500 mt-1">News and updates for the alumni community</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New</>}
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Panel as="form" onSubmit={submit} className="p-6 mb-6 space-y-4">
          <Input placeholder="Announcement title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input as="textarea" rows="5" placeholder="Write your announcement..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Button type="submit">Publish</Button>
        </Panel>
      )}

      <div className="space-y-4">
        {items.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            No announcements yet.
          </Panel>
        )}
        {items.map((a) => (
          <Panel key={a.id} className="p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <PosterBadge
                name={a.poster_name}
                email={a.poster_email}
                pic={a.poster_pic}
                role={a.poster_role}
                subtitle={a.poster_position}
                date={new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              />
              {isAdmin && (
                <button onClick={() => remove(a.id)} className="text-slate-400 hover:text-[var(--brand-danger)] p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <h3 className="text-xl font-bold text-[var(--brand-ink)] mb-2">{a.title}</h3>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
