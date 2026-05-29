import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, XCircle, DollarSign, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function EventRegistrations() {
  const { id } = useParams();
  const { user } = useAuth();
  const [regs, setRegs] = useState([]);
  const [err, setErr] = useState(null);

  const load = async () => {
    setErr(null);
    try {
      const { data } = await api.get(`/events/${id}/registrations`);
      setRegs(data.registrations);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load');
    }
  };

  useEffect(() => { load(); }, [id]);

  const patch = async (alumniId, body) => {
    try {
      await api.patch(`/events/${id}/registrations/${alumniId}`, body);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Update failed');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft size={14} /> Back to events
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="text-indigo-600" /> Event Registrations
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? 'Mark attendees as paid before the event' : 'View-only — only admin/president can mark payment'}
          </p>
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-4">{err}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {regs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No registrations yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="py-3 px-4 text-left">Alumni</th>
                <th className="py-3 px-4 text-left">Batch</th>
                <th className="py-3 px-4 text-left">RSVP</th>
                <th className="py-3 px-4 text-left">Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.rsvp_id} className="border-t border-slate-100">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{r.full_name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{r.batch_year}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.status === 'going' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {r.paid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 size={14} /> Paid</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-semibold"><XCircle size={14} /> Unpaid</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isAdmin ? (
                      <button
                        onClick={() => patch(r.alumni_id, { paid: !r.paid })}
                        className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold ${r.paid ? 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                      >
                        <DollarSign size={12} /> {r.paid ? 'Mark Unpaid' : 'Mark Paid'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Gate: alumni must RSVP <b>going</b> and be marked <b>paid</b> by the admin/president before check-in. Scanning at the event is done by <b>officers</b> (batch leaders) or admin.
      </div>
    </div>
  );
}
