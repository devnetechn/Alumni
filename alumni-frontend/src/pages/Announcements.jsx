import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import { Panel, Button, Input } from '../components/ui';

export default function Announcements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', agenda: [] });
  const [showForm, setShowForm] = useState(false);

  const load = () => api.get('/announcements').then((r) => setItems(r.data.announcements));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const agenda = form.agenda.filter((r) => r.activity.trim());
    await api.post('/announcements', { ...form, agenda });
    setForm({ title: '', body: '', agenda: [] });
    setShowForm(false);
    load();
  };

  const setAgendaRow = (i, patch) => setForm({ ...form, agenda: form.agenda.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

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
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-[var(--brand-ink)] mb-1">Agenda (optional)</legend>
            {form.agenda.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input className="!w-32" placeholder="9:00 AM" aria-label={`Agenda time ${i + 1}`} value={row.time} onChange={(e) => setAgendaRow(i, { time: e.target.value })} />
                <Input placeholder="Activity" aria-label={`Agenda activity ${i + 1}`} value={row.activity} onChange={(e) => setAgendaRow(i, { activity: e.target.value })} />
                <button type="button" aria-label={`Remove agenda row ${i + 1}`} onClick={() => setForm({ ...form, agenda: form.agenda.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-[var(--brand-danger)] p-1"><X size={16} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, agenda: [...form.agenda, { time: '', activity: '' }] })} className="text-sm font-semibold text-[var(--navy)] inline-flex items-center gap-1"><Plus size={14} /> Add agenda row</button>
          </fieldset>
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
            <h3 className="text-xl font-bold text-[var(--brand-ink)] mb-2"><Link to={`/announcements/${a.id}`} className="hover:underline">{a.title}</Link></h3>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
            {a.agenda?.length > 0 && <Link to={`/announcements/${a.id}`} className="inline-block mt-3 text-sm font-semibold text-[var(--navy)] underline">View agenda</Link>}
          </Panel>
        ))}
      </div>
    </div>
  );
}
