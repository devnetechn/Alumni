import { useEffect, useState } from 'react';
import { FileText, Calendar, Briefcase, Trash2, Shield } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import { Panel, Badge } from '../components/ui';

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
    return <div className="p-8 text-[var(--brand-danger)] font-semibold">Admin access required.</div>;
  }

  const tabs = [
    { id: 'announcements', label: 'Announcements', icon: FileText, count: announcements.length },
    { id: 'events', label: 'Events', icon: Calendar, count: events.length },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, count: jobs.length },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Shield className="text-[var(--brand-accent)]" size={28} />
          Manage Postings
        </h1>
        <p className="text-slate-500 mt-1">All announcements, events, and job postings in one place</p>
      </div>

      <div className="flex gap-2 mb-6 bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-1.5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius)] font-bold text-sm transition-colors ${
              tab === t.id ? 'bg-[var(--brand-accent)] text-white' : 'text-[var(--brand-ink)] hover:bg-[var(--brand-surface)]'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            <Badge tone="neutral" className={tab === t.id ? '!border-white' : ''}>{t.count}</Badge>
          </button>
        ))}
      </div>

      {tab === 'announcements' && (
        <List
          items={announcements}
          empty="No announcements yet."
          render={(a) => (
            <Row key={a.id} poster={a} title={a.title} body={a.body} date={a.created_at} onDelete={() => del('announcements', a.id)} />
          )}
        />
      )}

      {tab === 'events' && (
        <List
          items={events}
          empty="No events yet."
          render={(e) => (
            <Row key={e.id} poster={e} title={e.title} body={`${e.location || 'TBA'} · ${new Date(e.event_date).toLocaleString()}`} sub={e.description} date={e.created_at} onDelete={() => del('events', e.id)} />
          )}
        />
      )}

      {tab === 'jobs' && (
        <List
          items={jobs}
          empty="No job postings yet."
          render={(j) => (
            <Row key={j.id} poster={j} title={j.title} body={`${j.company || ''} ${j.location ? '· ' + j.location : ''}`} sub={j.description} date={j.created_at} onDelete={() => del('jobs', j.id)} />
          )}
        />
      )}
    </div>
  );
}

function List({ items, empty, render }) {
  if (items.length === 0) {
    return <Panel className="p-8 text-center text-slate-500">{empty}</Panel>;
  }
  return <div className="space-y-3">{items.map(render)}</div>;
}

function Row({ poster, title, body, sub, date, onDelete }) {
  return (
    <Panel className="p-5">
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
        <button onClick={onDelete} className="text-slate-400 hover:text-[var(--brand-danger)] p-1">
          <Trash2 size={16} />
        </button>
      </div>
      <h3 className="font-bold text-[var(--brand-ink)]">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{body}</p>
      {sub && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{sub}</p>}
    </Panel>
  );
}
