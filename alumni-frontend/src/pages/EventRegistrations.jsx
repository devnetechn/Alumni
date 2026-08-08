import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, XCircle, DollarSign, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Badge } from '../components/ui';

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
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[var(--brand-ink)] mb-4 font-semibold">
        <ArrowLeft size={14} /> Back to events
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
            <ClipboardCheck className="text-[var(--brand-accent)]" /> Event Registrations
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? 'Mark attendees as paid before the event' : 'View-only — only admin/president can mark payment'}
          </p>
        </div>
      </div>

      {err && (
        <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-4 rounded-[var(--radius)] mb-4">{err}</div>
      )}

      <Panel className="overflow-hidden">
        {regs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No registrations yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-[var(--brand-ink)] border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">Alumni</th>
                <th className="py-3 px-4 text-left font-bold">Batch</th>
                <th className="py-3 px-4 text-left font-bold">RSVP</th>
                <th className="py-3 px-4 text-left font-bold">Payment</th>
                <th className="py-3 px-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.rsvp_id} className="border-t border-slate-100">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[var(--brand-ink)]">{r.full_name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{r.batch_year}</td>
                  <td className="py-3 px-4">
                    <Badge tone={r.status === 'going' ? 'success' : 'neutral'}>{r.status}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    {r.paid ? (
                      <span className="inline-flex items-center gap-1 text-[var(--brand-success)] font-semibold"><CheckCircle2 size={14} /> Paid</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--brand-danger)] font-semibold"><XCircle size={14} /> Unpaid</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isAdmin ? (
                      <Button
                        variant={r.paid ? 'secondary' : 'primary'}
                        className="text-xs px-3 py-1.5"
                        onClick={() => patch(r.alumni_id, { paid: !r.paid })}
                      >
                        <DollarSign size={12} /> {r.paid ? 'Mark Unpaid' : 'Mark Paid'}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="mt-4 text-xs text-slate-500">
        Gate: alumni must RSVP <b>going</b> and be marked <b>paid</b> by the admin/president before check-in. Scanning at the event is done by <b>officers</b> (batch leaders) or admin.
      </div>
    </div>
  );
}
