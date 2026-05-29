import { useEffect, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';

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
          <h1 className="text-3xl font-bold text-slate-900">Announcements</h1>
          <p className="text-slate-500 mt-1">News and updates for the alumni community</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors">
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New</>}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={submit} className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 space-y-4">
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Announcement title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows="5"
            placeholder="Write your announcement..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors">
            Publish
          </button>
        </form>
      )}

      <div className="space-y-4">
        {items.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            No announcements yet.
          </div>
        )}
        {items.map((a) => (
          <article key={a.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-shadow">
            {/* Poster header */}
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
                <button onClick={() => remove(a.id)} className="text-slate-400 hover:text-red-600 p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-slate-900 mb-2">{a.title}</h3>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
