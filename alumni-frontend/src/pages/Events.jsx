import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PageHeader, { Section, Empty, Loading } from '../components/PageHeader';
import EventCard from '../components/EventCard';
import EventForm from '../components/EventForm';
import { Button } from '../components/ui';
import heroImg from '../assets/hero.png';

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [show, setShow] = useState(false);
  const [view, setView] = useState('upcoming');
  const [error, setError] = useState('');

  const load = () => api.get('/events').then((r) => setEvents(r.data.events)).catch(() => setError('Could not load events.'));
  useEffect(() => { load(); }, []);

  const now = new Date();
  const shown = (events || []).filter((e) => (view === 'upcoming' ? new Date(e.event_date) >= now : new Date(e.event_date) < now));
  if (view === 'past') shown.reverse();

  return (
    <>
      <PageHeader eyebrow="Events & reunions" title="Gather, celebrate, reconnect" image={heroImg}>
        Homecomings, batch reunions, networking evenings and school celebrations.
      </PageHeader>
      <Section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div role="tablist" aria-label="Event timeframe" className="inline-flex border border-[var(--line)] rounded-[var(--radius)] overflow-hidden">
            {['upcoming', 'past'].map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`px-5 py-2 text-sm font-semibold capitalize ${view === v ? 'bg-[var(--navy)] text-white' : 'bg-white text-[var(--navy)] hover:bg-[var(--paper-2)]'}`}>{v}</button>
            ))}
          </div>
          {user?.role === 'admin' && !show && <Button onClick={() => setShow(true)}><Plus size={16} aria-hidden="true" /> New event</Button>}
        </div>
        {show && <div className="mb-8"><EventForm onCancel={() => setShow(false)} onCreated={() => { setShow(false); load(); }} /></div>}
        {error && <p role="alert" className="text-sm text-[var(--brand-danger)] mb-4">{error}</p>}
        {events === null && !error ? <Loading /> : shown.length === 0 ? (
          <Empty title={view === 'upcoming' ? 'No upcoming events' : 'No past events'}>
            {user?.role === 'admin' ? 'Use “New event” to publish the first one.' : 'Events published by the association will appear here.'}
          </Empty>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{shown.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </Section>
    </>
  );
}
