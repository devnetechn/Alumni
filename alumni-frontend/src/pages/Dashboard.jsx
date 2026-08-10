import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Megaphone, MessageSquare, UsersRound, UserCircle, ArrowRight, MapPin, Users } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel } from '../components/ui';

const SHORTCUTS = [
  { to: '/events', label: 'Events', icon: Calendar, description: 'See upcoming reunions and gatherings' },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, description: 'Catch up on the latest news' },
  { to: '/messages', label: 'Messages', icon: MessageSquare, description: 'Chat with fellow alumni' },
  { to: '/groups', label: 'Groups', icon: UsersRound, description: 'Join batch and interest groups' },
  { to: '/profile', label: 'Profile', icon: UserCircle, description: 'Update your info and photo' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(' ')[0] || user?.email;
  const [upcoming, setUpcoming] = useState([]);
  const [rsvpCounts, setRsvpCounts] = useState({});

  useEffect(() => {
    api.get('/events').then(async ({ data }) => {
      const now = new Date();
      const next = data.events
        .filter((ev) => new Date(ev.event_date) >= now)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
        .slice(0, 3);
      setUpcoming(next);

      const counts = {};
      await Promise.all(next.map(async (ev) => {
        try {
          const r = await api.get(`/events/${ev.id}/rsvp`);
          counts[ev.id] = r.data.counts;
        } catch {}
      }));
      setRsvpCounts(counts);
    });
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">Welcome back, {firstName}!</h1>
        <p className="text-slate-500 mt-1">What would you like to do today?</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-[var(--brand-ink)]">Upcoming Events</h2>
        <Link to="/events" className="text-sm font-bold text-[var(--brand-accent)] hover:underline">
          View all →
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <Panel className="p-6 text-slate-500 mb-10">No upcoming events right now.</Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {upcoming.map((ev) => {
            const d = new Date(ev.event_date);
            const counts = rsvpCounts[ev.id];
            const going = counts ? counts.going : null;
            return (
              <Panel key={ev.id} className="p-5">
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                  {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <h3 className="font-bold text-[var(--brand-ink)] mb-2">{ev.title}</h3>
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
                    <MapPin size={14} />
                    {ev.location}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Users size={14} />
                  {going === null ? 'Loading…' : `${going} going`}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SHORTCUTS.map(({ to, label, icon: Icon, description }) => (
          <Link
            key={to}
            to={to}
            className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-5 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
          >
            <div className="p-2.5 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] inline-flex mb-4">
              <Icon className="text-white" size={20} />
            </div>
            <h2 className="font-bold text-[var(--brand-ink)] flex items-center gap-1.5">
              {label}
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </h2>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
