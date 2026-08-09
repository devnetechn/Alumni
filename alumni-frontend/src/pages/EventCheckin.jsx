import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';
import { api, API_BASE } from '../api';
import { Panel, Button, Badge } from '../components/ui';
import { useAuth } from '../auth';
import AlumniScanner from '../components/AlumniScanner';
import EventPhotosManager from '../components/EventPhotosManager';

export default function EventCheckin() {
  const { id } = useParams();
  const { user } = useAuth();
  const isOfficer = user?.role === 'admin' || user?.is_batch_leader;
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const canvasRef = useRef(null);

  const loadAttendance = () => api.get(`/events/${id}/checkin`).then((r) => setAttendance(r.data.attendance));

  useEffect(() => {
    api.get(`/events/${id}`).then((r) => setEvent(r.data.event)).catch(() => {});
    loadAttendance();
  }, [id]);

  useEffect(() => {
    if (canvasRef.current) {
      const payload = `EVENT:${id}`;
      QRCode.toCanvas(canvasRef.current, payload, {
        width: 280,
        margin: 2,
        color: { dark: '#111111', light: '#ffffff' },
      });
    }
  }, [id]);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Event Check-in</h1>
          <p className="text-slate-500 mt-1">Show this QR code to alumni at the entrance</p>
        </div>
        <a href={`${API_BASE}/api/events/${id}/export`}>
          <Button variant="secondary">
            <Download size={18} />
            Export CSV
          </Button>
        </a>
      </div>

      <Panel className="p-8 mb-6 flex flex-col items-center">
        {event && (
          <div className="text-center mb-4">
            <h2 className="font-display text-2xl text-[var(--brand-ink)]">{event.title}</h2>
            {event.location && <p className="text-slate-500">{event.location}</p>}
            <p className="text-sm text-slate-500">{new Date(event.event_date).toLocaleString()}</p>
          </div>
        )}
        <div className="p-4 bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)]">
          <canvas ref={canvasRef} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <QrCode size={16} />
          <span>Event code: <span className="font-mono font-semibold">EVENT:{id}</span></span>
        </div>
      </Panel>

      {isOfficer && <AlumniScanner eventId={id} onCheckedIn={loadAttendance} />}

      {isOfficer && <EventPhotosManager eventId={id} />}

      <Panel className="overflow-hidden">
        <div className="p-6 border-b-[2.5px] border-[var(--brand-ink)] flex items-center justify-between">
          <h2 className="font-bold text-[var(--brand-ink)]">Attendance List</h2>
          <Badge tone="accent">{attendance.length} checked in</Badge>
        </div>
        {attendance.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No check-ins yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--brand-ink)] text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-6 font-bold">Name</th>
                  <th className="py-3 px-6 font-bold">Batch</th>
                  <th className="py-3 px-6 font-bold">Course</th>
                  <th className="py-3 px-6 font-bold">Time</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-[var(--brand-surface)]">
                    <td className="py-3 px-6 font-semibold text-[var(--brand-ink)]">{a.full_name}</td>
                    <td className="py-3 px-6 text-slate-600">{a.batch_year}</td>
                    <td className="py-3 px-6 text-slate-600">{a.course}</td>
                    <td className="py-3 px-6 text-slate-500">{new Date(a.checked_in_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
