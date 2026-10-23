import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Users, Hourglass } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { eventStatus } from '../components/EventCard';
import { Section, Empty, Loading } from '../components/PageHeader';
import { Badge, Button } from '../components/ui';
import { FormAlert } from '../components/layout/AuthSplit';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/events/${id}`).then((r) => setData(r.data)).catch(() => setMissing(true));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rsvp = async (status) => {
    setBusy(true); setError('');
    try { await api.post(`/events/${id}/rsvp`, { status }); await load(); }
    catch (e) { setError(e.response?.data?.error || 'Could not update your registration.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('Delete this event?')) return;
    await api.delete(`/events/${id}`);
    nav('/events');
  };

  if (missing) return <Section><Empty title="Event not found">It may have been removed, or it is private to a batch.</Empty></Section>;
  if (!data) return <Loading />;

  const { event, myStatus, canManage } = data;
  const d = new Date(event.event_date);
  const status = eventStatus(event, myStatus);
  const past = d < new Date();
  const closed = !past && event.registration_deadline && new Date(event.registration_deadline) < new Date();
  const full = event.capacity && event.going_count >= event.capacity && myStatus !== 'going';

  return (
    <>
      <section className="relative bg-[var(--navy)] text-white on-dark overflow-hidden">
        {event.cover_image && <img src={event.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--navy)] via-[var(--navy)]/85 to-[var(--navy-2)]/60" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex gap-2 mb-4"><Badge tone={status.tone}>{status.label}</Badge>{event.batch_name && <Badge tone="neutral">{event.batch_name}</Badge>}</div>
          <h1 className="serif text-4xl md:text-5xl leading-tight">{event.title}</h1>
          <span className="gold-rule mt-5" />
        </div>
      </section>
      <Section>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            <h2 className="serif text-2xl text-[var(--navy)]">About this event</h2>
            <p className="mt-4 text-[var(--muted)] leading-relaxed whitespace-pre-line">{event.description || 'No description provided.'}</p>
          </div>
          <aside className="card p-6 h-fit space-y-4 border-t-2 !border-t-[var(--gold)]">
            <p className="flex gap-3 text-sm"><CalendarDays size={18} className="text-[var(--gold-deep)] shrink-0" aria-hidden="true" />{d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="flex gap-3 text-sm"><Clock size={18} className="text-[var(--gold-deep)] shrink-0" aria-hidden="true" />{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
            {event.location && <p className="flex gap-3 text-sm"><MapPin size={18} className="text-[var(--gold-deep)] shrink-0" aria-hidden="true" />{event.location}</p>}
            {event.registration_deadline && <p className="flex gap-3 text-sm"><Hourglass size={18} className="text-[var(--gold-deep)] shrink-0" aria-hidden="true" />Register by {new Date(event.registration_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
            <p className="flex gap-3 text-sm"><Users size={18} className="text-[var(--gold-deep)] shrink-0" aria-hidden="true" />{event.going_count} registered{event.capacity ? ` of ${event.capacity}` : ''}</p>

            <div className="pt-4 border-t border-[var(--line)] space-y-3">
              <FormAlert>{error}</FormAlert>
              {past ? <p className="text-sm text-[var(--muted)]">This event has already taken place.</p>
                : !user ? <Link to="/login"><Button className="w-full">Log in to register</Button></Link>
                : myStatus === 'going' ? (
                  <>
                    <p className="text-sm font-semibold text-[var(--brand-success)]">You are registered.</p>
                    <Button variant="secondary" className="w-full" disabled={busy} onClick={() => rsvp('not_going')}>Cancel registration</Button>
                  </>
                ) : closed ? <p className="text-sm text-[var(--brand-danger)]">Registration for this event has closed.</p>
                  : full ? <p className="text-sm text-[var(--brand-danger)]">This event is at full capacity.</p>
                    : <Button className="w-full" disabled={busy} onClick={() => rsvp('going')}>{busy ? 'Registering…' : 'Register for this event'}</Button>}
            </div>
            {canManage && (
              <div className="pt-4 border-t border-[var(--line)] flex flex-col gap-2">
                {user?.role === 'admin' && <Link to={`/events/${event.id}/registrations`}><Button variant="secondary" className="w-full">View registrations</Button></Link>}
                <Button variant="ghost" className="!text-[var(--brand-danger)]" onClick={remove}>Delete event</Button>
              </div>
            )}
          </aside>
        </div>
      </Section>
    </>
  );
}
