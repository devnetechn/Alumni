import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Calendar, Clock, QrCode, X, Check, HelpCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';

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
          <h1 className="text-3xl font-bold text-slate-900">Events</h1>
          <p className="text-slate-500 mt-1">Upcoming alumni gatherings and activities</p>
        </div>
        {user.role === 'admin' && (
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors">
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Event</>}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 grid grid-cols-2 gap-4">
          <input className="border border-slate-300 rounded-lg px-3 py-2.5 col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input type="datetime-local" className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
          <textarea className="border border-slate-300 rounded-lg px-3 py-2.5 col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="col-span-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg font-semibold transition-colors">Create Event</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.length === 0 && (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            No events yet.
          </div>
        )}
        {events.map((ev) => {
          const d = new Date(ev.event_date);
          return (
            <div key={ev.id} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all">
              <div className="bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80 mb-1">
                  <Calendar size={12} />
                  {d.toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="text-4xl font-extrabold">
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center gap-1 text-sm opacity-90 mt-1">
                  <Clock size={12} />
                  {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{ev.title}</h3>
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                    <MapPin size={14} />
                    {ev.location}
                  </div>
                )}
                <p className="text-sm text-slate-600 line-clamp-2 mb-4">{ev.description}</p>

                {rsvpState[ev.id]?.counts && (
                  <div className="flex gap-3 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" /> {rsvpState[ev.id].counts.going} going</span>
                    <span className="flex items-center gap-1"><HelpCircle size={12} className="text-amber-500" /> {rsvpState[ev.id].counts.maybe}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1 mb-3">
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'going'} onClick={() => rsvp(ev.id, 'going')} color="emerald" icon={Check} label="Going" />
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'maybe'} onClick={() => rsvp(ev.id, 'maybe')} color="amber" icon={HelpCircle} label="Maybe" />
                  <RsvpBtn active={rsvpState[ev.id]?.myStatus === 'not_going'} onClick={() => rsvp(ev.id, 'not_going')} color="red" icon={XCircle} label="No" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link to={`/events/${ev.id}/checkin`} className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 px-3 py-2 rounded-lg font-semibold text-sm transition-colors justify-center">
                    <QrCode size={16} />
                    Check-in
                  </Link>
                  <Link to={`/events/${ev.id}/registrations`} className="inline-flex items-center gap-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 px-3 py-2 rounded-lg font-semibold text-sm transition-colors justify-center">
                    <ClipboardCheck size={16} />
                    Registrations
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RsvpBtn({ active, onClick, color, icon: Icon, label }) {
  const colorMap = {
    emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300',
    amber: active ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300',
    red: active ? 'bg-red-600 text-white border-red-600' : 'border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300',
  };
  return (
    <button onClick={onClick} className={`border px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${colorMap[color]}`}>
      <Icon size={12} /> {label}
    </button>
  );
}
