import { useEffect, useState } from 'react';
import { Sparkles, Calendar } from 'lucide-react';
import { api } from '../api';
import { Panel } from '../components/ui';
import EventPhotosManager from '../components/EventPhotosManager';

export default function AdminHighlights() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/events').then((r) => {
      const now = new Date();
      const past = r.data.events
        .filter((e) => new Date(e.event_date) < now)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
      setEvents(past);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Sparkles className="text-[var(--brand-accent)]" /> Highlights
        </h1>
        <p className="text-slate-500 mt-1">Pick a past event to manage its photos and videos.</p>
      </div>

      {loading && <div className="text-slate-500">Loading events...</div>}

      <div className="space-y-3 mb-8">
        {events.map((ev) => (
          <Panel
            key={ev.id}
            as="button"
            onClick={() => setSelected(ev)}
            className={`w-full text-left p-5 hover:shadow-[4px_4px_0_var(--brand-accent)] hover:border-[var(--brand-accent)] transition-all ${
              selected?.id === ev.id ? 'shadow-[4px_4px_0_var(--brand-accent)] border-[var(--brand-accent)]' : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-3 rounded-[var(--radius)]">
                <Calendar className="text-white" size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[var(--brand-ink)]">{ev.title}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(ev.event_date).toLocaleDateString()} {ev.location ? `· ${ev.location}` : ''}
                </p>
              </div>
            </div>
          </Panel>
        ))}
        {!loading && events.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            No past events yet.
          </Panel>
        )}
      </div>

      {selected && <EventPhotosManager eventId={selected.id} />}
    </div>
  );
}
