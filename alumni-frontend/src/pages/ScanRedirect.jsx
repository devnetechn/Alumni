import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Calendar } from 'lucide-react';
import { api } from '../api';
import { Panel } from '../components/ui';

// Entry point para sa officers: list upcoming events, tap to scan.
export default function ScanRedirect() {
  const nav = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events').then((r) => {
      const now = new Date();
      const upcoming = r.data.events
        .filter((e) => new Date(e.event_date) >= new Date(now.getTime() - 24 * 3600 * 1000))
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
      setEvents(upcoming.length ? upcoming : r.data.events);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <QrCode className="text-[var(--brand-accent)]" /> Scan Check-in
        </h1>
        <p className="text-slate-500 mt-1">Pilia ang event nga inyo gi-man sa scanning.</p>
      </div>

      {loading && <div className="text-slate-500">Loading events...</div>}

      <div className="space-y-3">
        {events.map((ev) => (
          <Panel
            key={ev.id}
            as="button"
            onClick={() => nav(`/events/${ev.id}/checkin`)}
            className="w-full text-left p-5 hover:shadow-[4px_4px_0_var(--brand-accent)] hover:border-[var(--brand-accent)] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-3 rounded-[var(--radius)]">
                <Calendar className="text-white" size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[var(--brand-ink)]">{ev.title}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(ev.event_date).toLocaleString()} {ev.location ? `· ${ev.location}` : ''}
                </p>
              </div>
              <QrCode className="text-slate-400" size={22} />
            </div>
          </Panel>
        ))}
        {!loading && events.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            Walay event available.
          </Panel>
        )}
      </div>
    </div>
  );
}
