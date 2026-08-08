import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Calendar, Clock, QrCode, X, Check, HelpCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Input } from '../components/ui';

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', event_date: '' });

  const [rsvpState, setRsvpState] = useState({});

  const load = async () => {
    const { data } = await api.get('/events');
    setEvents(data.events);
    const states = {};
    await Promise.all(data.events.map(async (ev) => {
      try {
        const r = await api.get(`/events/${ev.id}/rsvp`);
        states[ev.id] = { counts: r.data.counts, myStatus: r.data.myStatus };
      } catch {}
    }));
    setRsvpState(states);
  };
  useEffect(() => { load(); }, []);

  const rsvp = async (eventId, status) => {
    await api.post(`/events/${eventId}/rsvp`, { status });
    load();
  };

  const create = async (e) => {
    e.preventDefault();
    await api.post('/events', form);
    setForm({ title: '', description: '', location: '', event_date: '' });
    setShowForm(false);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Events</h1>
          <p className="text-slate-500 mt-1">Upcoming alumni gatherings and activities</p>
        </div>
        {user.role === 'admin' && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Event</>}
          </Button>
        )}
      </div>

      {showForm && (
        <Panel as="form" onSubmit={create} className="p-6 mb-6 grid grid-cols-2 gap-4">
          <Input className="col-span-2" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
          <Input as="textarea" className="col-span-2" rows="3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button type="submit" className="col-span-2">Create Event</Button>
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.length === 0 && (
          <Panel className="col-span-full p-8 text-center text-slate-500">
            No events yet.
          </Panel>
        )}
        {events.map((ev) => {
          const d = new Date(ev.event_date);
          return (
            <Panel key={ev.id} className="overflow-hidden group">
              <div className="bg-[var(--brand-ink)] p-6 text-white">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-70 mb-1">
                  <Calendar size={12} />
                  {d.toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="font-display text-4xl">
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center gap-1 text-sm opacity-80 mt-1">
                  <Clock size={12} />
                  {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-[var(--brand-ink)] mb-2 group-hover:text-[var(--brand-accent)] transition-colors">{ev.title}</h3>
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                    <MapPin size={14} />
                    {ev.location}
                  </div>
                )}
                <p className="text-sm text-slate-600 line-clamp-2 mb-4">{ev.description}</p>

                {rsvpState[ev.id]?.counts && (
                  <div className="flex gap-3 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1"><Check size={12} className="text-[var(--brand-success)]" /> {rsvpState[ev.id].counts.going} going</span>
                    <span className="flex items-center gap-1"><HelpCircle size={12} className="text-[#b8860b]" /> {rsvpState[ev.id].counts.maybe}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1 mb-3">
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'going'} onClick={() => rsvp(ev.id, 'going')} tone="success" icon={Check} label="Going" />
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'maybe'} onClick={() => rsvp(ev.id, 'maybe')} tone="warning" icon={HelpCircle} label="Maybe" />
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'not_going'} onClick={() => rsvp(ev.id, 'not_going')} tone="danger" icon={XCircle} label="No" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link to={`/events/${ev.id}/checkin`}>
                    <Button variant="secondary" className="w-full">
                      <QrCode size={16} /> Check-in
                    </Button>
                  </Link>
                  <Link to={`/events/${ev.id}/registrations`}>
                    <Button variant="secondary" className="w-full">
                      <ClipboardCheck size={16} /> Registrations
                    </Button>
                  </Link>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function RsvpBtn({ active, onClick, tone, icon: Icon, label }) {
  const toneMap = {
    success: active ? 'bg-[var(--brand-success)] text-white border-[var(--brand-ink)]' : 'border-slate-300 text-slate-600 hover:border-[var(--brand-success)]',
    warning: active ? 'bg-[#ffd23f] text-[var(--brand-ink)] border-[var(--brand-ink)]' : 'border-slate-300 text-slate-600 hover:border-[#b8860b]',
    danger: active ? 'bg-[var(--brand-danger)] text-white border-[var(--brand-ink)]' : 'border-slate-300 text-slate-600 hover:border-[var(--brand-danger)]',
  };
  return (
    <button onClick={onClick} className={`border-2 px-2 py-1.5 rounded-[var(--radius)] text-xs font-bold flex items-center justify-center gap-1 transition-colors ${toneMap[tone]}`}>
      <Icon size={12} /> {label}
    </button>
  );
}
