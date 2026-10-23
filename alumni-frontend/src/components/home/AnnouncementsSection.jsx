import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { Section } from '../PageHeader';

export default function AnnouncementsSection({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <Section tone="paper" eyebrow="Announcements" title="What's coming up">
      <div className="grid md:grid-cols-3 gap-6">
        {items.map((a) => (
          <Link key={a.id} to={`/announcements/${a.id}`} className="card card-hover p-6 border-t-2 !border-t-[var(--gold)] block">
            <p className="text-xs text-[var(--muted)]">{new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <h3 className="serif text-xl text-[var(--navy)] mt-2">{a.title}</h3>
            {a.body && <p className="text-sm text-[var(--muted)] mt-2 line-clamp-3">{a.body}</p>}
            {a.agenda?.length > 0 && (
              <p className="mt-4 text-sm font-semibold text-[var(--navy)] inline-flex items-center gap-1.5"><ListChecks size={14} aria-hidden="true" /> See agenda</p>
            )}
          </Link>
        ))}
      </div>
    </Section>
  );
}
