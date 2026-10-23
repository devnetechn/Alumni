import { Link } from 'react-router-dom';
import { Section } from '../PageHeader';
import Avatar from '../ui/Avatar';

export default function AlumniFaces({ items }) {
  if (!items) return null;
  return (
    <Section eyebrow="Faces Behind the Success" title="Alumni who make us proud">
      {items.length === 0 && <p className="text-[var(--muted)]">Stories of our alumni's growth, as people and as professionals, are coming soon.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.slice(0, 6).map((s) => (
          <Link key={s.id} to={`/alumni-stories/${s.id}`} className="card card-hover p-6 flex gap-4 items-start">
            {s.photo
              ? <img src={s.photo} alt="" className="w-20 h-20 rounded-full object-cover flex-shrink-0 ring-1 ring-[var(--gold)]/60" loading="lazy" />
              : <Avatar name={s.name} size="lg" />}
            <div className="min-w-0">
              <h3 className="serif text-xl text-[var(--navy)]">{s.name}</h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">{[s.batch_label, s.role_title].filter(Boolean).join(' · ')}</p>
              {s.quote && <p className="text-sm text-[var(--text)] mt-3 italic line-clamp-3">“{s.quote}”</p>}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
