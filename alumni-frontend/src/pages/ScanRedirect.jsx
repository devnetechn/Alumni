import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Calendar } from 'lucide-react';
import { api } from '../api';

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
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <QrCode className="text-indigo-600" /> Scan Check-in
        </h1>
        <p className="text-slate-500 mt-1">Pilia ang event nga inyo gi-man sa scanning.</p>
      </div>

      {loading && <div className="text-slate-500">Loading events...</div>}

      <div className="space-y-3">
        {events.map((ev) => (
          <button
            key={ev.id}
            onClick={() => nav(`/events/${ev.id}/checkin`)}
            className="w-full text-left bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl">
                <Calendar className="text-white" size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{ev.title}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(ev.event_date).toLocaleString()} {ev.location ? `· ${ev.location}` : ''}
                </p>
              </div>
              <QrCode className="text-slate-400" size={22} />
            </div>
          </button>
        ))}
        {!loading && events.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            Walay event available.
          </div>
        )}
      </div>
    </div>
  );
}
