import { useEffect, useState } from 'react';
import { FileText, Calendar, Briefcase, Trash2, Shield } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';

export default function AdminPostings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('announcements');
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [jobs, setJobs] = useState([]);

  const load = async () => {
    const [a, e, j] = await Promise.all([
      api.get('/announcements'),
      api.get('/events'),
      api.get('/jobs'),
    ]);
    setAnnouncements(a.data.announcements);
    setEvents(e.data.events);
    setJobs(j.data.jobs);
  };

  useEffect(() => { load(); }, []);

  const del = async (type, id) => {
    if (!confirm('Delete this posting?')) return;
    await api.delete(`/${type}/${id}`);
    load();
  };

  if (user?.role !== 'admin') {
    return <div className="p-8 text-red-600">Admin access required.</div>;
  }

  const tabs = [
    { id: 'announcements', label: 'Announcements', icon: FileText, count: announcements.length, color: 'indigo' },
    { id: 'events', label: 'Events', icon: Calendar, count: events.length, color: 'purple' },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, count: jobs.length, color: 'pink' },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="text-indigo-600" size={28} />
          Manage Postings
        </h1>
        <p className="text-slate-500 mt-1">All announcements, events, and job postings in one place</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              tab === t.id ? 'bg-white/20' : 'bg-slate-200'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'announcements' && (
        <List
          items={announcements}
          empty="No announcements yet."
          render={(a) => (
            <Row
              key={a.id}
              poster={a}
              title={a.title}
              body={a.body}
              date={a.created_at}
              onDelete={() => del('announcements', a.id)}
            />
          )}
        />
      )}

      {tab === 'events' && (
        <List
          items={events}
          empty="No events yet."
          render={(e) => (
            <Row
              key={e.id}
              poster={e}
              title={e.title}
              body={`${e.location || 'TBA'} · ${new Date(e.event_date).toLocaleString()}`}
              sub={e.description}
              date={e.created_at}
              onDelete={() => del('events', e.id)}
            />
          )}
        />
      )}

      {tab === 'jobs' && (
        <List
          items={jobs}
          empty="No job postings yet."
          render={(j) => (
            <Row
              key={j.id}
              poster={j}
              title={j.title}
              body={`${j.company || ''} ${j.location ? '· ' + j.location : ''}`}
              sub={j.description}
              date={j.created_at}
              onDelete={() => del('jobs', j.id)}
            />
          )}
        />
      )}
    </div>
  );
}

function List({ items, empty, render }) {
  if (items.length === 0) {
    return <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">{empty}</div>;
  }
  return <div className="space-y-3">{items.map(render)}</div>;
}

function Row({ poster, title, body, sub, date, onDelete }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <PosterBadge
          name={poster.poster_name}
          email={poster.poster_email}
          pic={poster.poster_pic}
          role={poster.poster_role}
          subtitle={poster.poster_position}
          date={new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          size="sm"
        />
        <button onClick={onDelete} className="text-slate-400 hover:text-red-600 p-1">
          <Trash2 size={16} />
        </button>
      </div>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{body}</p>
      {sub && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{sub}</p>}
    </div>
  );
}
