import { Link } from 'react-router-dom';
import { MapPin, Users } from 'lucide-react';
import { Badge } from './ui';

export function eventStatus(event, myStatus) {
  const now = new Date();
  if (new Date(event.event_date) < now) return { label: 'Past event', tone: 'neutral' };
  if (myStatus === 'going') return { label: 'You are registered', tone: 'success' };
  if (event.registration_deadline && new Date(event.registration_deadline) < now) return { label: 'Registration closed', tone: 'danger' };
  if (event.capacity && event.going_count >= event.capacity) return { label: 'Full', tone: 'danger' };
  return { label: 'Open for registration', tone: 'accent' };
}

export default function EventCard({ event, myStatus }) {
  const d = new Date(event.event_date);
  const status = eventStatus(event, myStatus);
  return (
    <Link to={`/events/${event.id}`} className="card card-hover overflow-hidden flex flex-col group">
      <div className="relative h-44 bg-[var(--navy)] overflow-hidden">
        {event.cover_image && <img src={event.cover_image} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />}
        <div className="absolute top-0 left-5 bg-[var(--gold)] text-[var(--navy)] text-center px-3 py-2 leading-none">
          <p className="serif text-2xl">{d.getDate()}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1">{d.toLocaleDateString('en-US', { month: 'short' })}</p>
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge tone={status.tone}>{status.label}</Badge>
          {event.batch_name && <Badge tone="navy">{event.batch_name}</Badge>}
        </div>
        <h3 className="serif text-xl text-[var(--navy)] leading-snug">{event.title}</h3>
        <div className="mt-3 space-y-1.5 text-sm text-[var(--muted)]">
          <p>{d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          {event.location && <p className="flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" />{event.location}</p>}
          {event.capacity && <p className="flex items-center gap-1.5"><Users size={14} aria-hidden="true" />{event.going_count} / {event.capacity} registered</p>}
        </div>
      </div>
    </Link>
  );
}
