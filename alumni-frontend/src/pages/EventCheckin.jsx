import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';
import { api, API_BASE } from '../api';

export default function EventCheckin() {
  const { id } = useParams();
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
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    }
  }, [id]);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Event Check-in</h1>
          <p className="text-slate-500 mt-1">Show this QR code to alumni at the entrance</p>
        </div>
        <a
          href={`${API_BASE}/api/events/${id}/export`}
          className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg font-semibold transition-colors"
        >
          <Download size={18} />
          Export CSV
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6 flex flex-col items-center">
        {event && (
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-slate-900">{event.title}</h2>
            {event.location && <p className="text-slate-500">{event.location}</p>}
            <p className="text-sm text-slate-500">{new Date(event.event_date).toLocaleString()}</p>
          </div>
        )}
        <div className="p-4 bg-white border-4 border-slate-900 rounded-2xl">
          <canvas ref={canvasRef} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <QrCode size={16} />
          <span>Event code: <span className="font-mono font-semibold">EVENT:{id}</span></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Attendance List</h2>
          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
            {attendance.length} checked in
          </span>
        </div>
        {attendance.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No check-ins yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600 text-xs uppercase tracking-wider">
                  <th className="py-3 px-6 font-semibold">Name</th>
                  <th className="py-3 px-6 font-semibold">Batch</th>
                  <th className="py-3 px-6 font-semibold">Course</th>
                  <th className="py-3 px-6 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-6 font-semibold text-slate-900">{a.full_name}</td>
                    <td className="py-3 px-6 text-slate-600">{a.batch_year}</td>
                    <td className="py-3 px-6 text-slate-600">{a.course}</td>
                    <td className="py-3 px-6 text-slate-500">{new Date(a.checked_in_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
