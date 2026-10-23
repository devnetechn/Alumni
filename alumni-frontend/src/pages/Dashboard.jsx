import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, CalendarDays, Layers, Inbox, UserCircle } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Badge, Button, StatTile } from '../components/ui';
import { Empty } from '../components/PageHeader';

const STATUS = {
  pending: ['warning', 'Pending review'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Not approved'],
};

export default function Dashboard() {
  const { user, membership, managedBatches } = useAuth();
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  const isAdmin = user.role === 'admin';
  const isPresident = managedBatches.length > 0;
  const approvedBatchId = membership?.status === 'approved' ? membership.batch_id : null;

  useEffect(() => {
    api.get('/events').then((r) => setEvents(r.data.events.filter((e) => new Date(e.event_date) >= new Date()).slice(0, 3))).catch(() => {});
    api.get('/notifications').then((r) => setNotes(r.data.notifications.slice(0, 4))).catch(() => {});
    api.get('/announcements').then((r) => setAnnouncements((a) => [...a, ...r.data.announcements.slice(0, 2).map((x) => ({ id: `s${x.id}`, title: x.title, body: x.body, at: x.created_at }))])).catch(() => {});
    if (isAdmin) {
      api.get('/public-stats').then((r) => setStats(r.data));
      api.get('/batches/admin/requests', { params: { status: 'pending' } }).then((r) => setPending(r.data.requests.length));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!approvedBatchId) return;
    api.get(`/batches/${approvedBatchId}/posts`, { params: { kind: 'announcement' } })
      .then((r) => setAnnouncements((a) => [...r.data.posts.slice(0, 2).map((x) => ({ id: `b${x.id}`, title: `${membership.batch_name} announcement`, body: x.body, at: x.created_at })), ...a]))
      .catch(() => {});
  }, [approvedBatchId, membership?.batch_name]);

  const first = user.full_name?.split(' ')[0] || user.email;
  const [tone, label] = STATUS[membership?.status] || ['neutral', 'No batch selected'];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <p className="eyebrow mb-2">{isAdmin ? 'Super administrator' : isPresident ? 'Batch president' : 'Alumni member'}</p>
      <h1 className="serif text-3xl md:text-4xl text-[var(--navy)]">Welcome back, {first}</h1>
      <span className="gold-rule mt-4" />

      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <StatTile label="Batches" value={stats?.batches ?? '—'} icon={Layers} />
          <StatTile label="Approved alumni" value={stats?.alumni ?? '—'} icon={Users} />
          <StatTile label="Upcoming events" value={stats?.upcoming_events ?? '—'} icon={CalendarDays} />
          <StatTile label="Pending requests" value={pending ?? '—'} icon={Inbox} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-6 border-t-2 !border-t-[var(--gold)]">
            <div className="flex items-center gap-4">
              <Avatar name={user.full_name} email={user.email} pic={user.profile_pic} size="lg" />
              <div className="min-w-0">
                <h2 className="serif text-xl text-[var(--navy)] truncate">{user.full_name || user.email}</h2>
                <p className="text-sm text-[var(--muted)]">{user.batch_year ? `Class of ${user.batch_year}` : 'No graduation year on file'}</p>
              </div>
              <Link to="/profile" className="ml-auto"><Button variant="secondary"><UserCircle size={16} aria-hidden="true" /> Edit profile</Button></Link>
            </div>
            {!isAdmin && (
              <div className="mt-5 pt-5 border-t border-[var(--line)] flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="text-xs text-[var(--muted)]">Batch membership</p>
                  <p className="font-semibold text-[var(--navy)] flex items-center gap-2 mt-1">{membership?.batch_name || '—'} <Badge tone={tone}>{label}</Badge></p>
                </div>
                {approvedBatchId ? <Link to={`/batches/${approvedBatchId}/community`}><Button>Open batch community <ArrowRight size={16} aria-hidden="true" /></Button></Link>
                  : <Link to="/membership"><Button variant="secondary">View membership status</Button></Link>}
              </div>
            )}
          </section>

          {(isPresident || isAdmin) && (
            <section className="card p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="serif text-xl text-[var(--navy)]">{isAdmin ? 'Administration' : 'Manage your batch'}</h2>
                <p className="text-sm text-[var(--muted)] mt-1">{isAdmin ? 'Batches, presidents, requests, events and audit log.' : 'Review requests, manage members and publish announcements.'}</p>
              </div>
              <div className="flex gap-3">
                <Link to="/president"><Button variant="navy">Batch dashboard</Button></Link>
                {isAdmin && <Link to="/admin/batches"><Button variant="secondary">Batches &amp; oversight</Button></Link>}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3"><h2 className="serif text-xl text-[var(--navy)]">Upcoming events</h2><Link to="/events" className="text-sm font-semibold text-[var(--navy)] underline decoration-[var(--gold)]">View all</Link></div>
            {events.length === 0 ? <Empty title="No upcoming events" /> : (
              <ul className="space-y-3">{events.map((e) => (
                <li key={e.id}><Link to={`/events/${e.id}`} className="card card-hover p-4 flex items-center gap-4">
                  <div className="bg-[var(--navy)] text-white text-center px-3 py-2 leading-none shrink-0"><p className="serif text-xl text-[var(--gold)]">{new Date(e.event_date).getDate()}</p><p className="text-[10px] uppercase tracking-widest mt-1">{new Date(e.event_date).toLocaleDateString('en-US', { month: 'short' })}</p></div>
                  <div className="min-w-0"><p className="font-semibold text-[var(--navy)] truncate">{e.title}</p><p className="text-xs text-[var(--muted)] truncate">{e.location || 'Location to be announced'}</p></div>
                </Link></li>
              ))}</ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3"><h2 className="serif text-lg text-[var(--navy)]">Notifications</h2><Link to="/notifications" className="text-xs font-semibold underline decoration-[var(--gold)]">All</Link></div>
            {notes.length === 0 ? <p className="text-sm text-[var(--muted)]">You are all caught up.</p> : (
              <ul className="space-y-3">{notes.map((n) => (
                <li key={n.id} className="text-sm"><p className={`${n.read_at ? 'text-[var(--muted)]' : 'text-[var(--navy)] font-semibold'}`}>{n.title}</p>{n.body && <p className="text-xs text-[var(--muted)] line-clamp-2">{n.body}</p>}</li>
              ))}</ul>
            )}
          </section>
          <section className="card p-5">
            <h2 className="serif text-lg text-[var(--navy)] mb-3">Recent announcements</h2>
            {announcements.length === 0 ? <p className="text-sm text-[var(--muted)]">No announcements yet.</p> : (
              <ul className="space-y-3">{announcements.slice(0, 4).map((a) => (
                <li key={a.id}><p className="text-sm font-semibold text-[var(--navy)]">{a.title}</p>{a.body && <p className="text-xs text-[var(--muted)] line-clamp-2">{a.body}</p>}</li>
              ))}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
