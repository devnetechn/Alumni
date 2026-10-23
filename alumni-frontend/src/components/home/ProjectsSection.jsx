import { Link } from 'react-router-dom';
import { Section } from '../PageHeader';

export default function ProjectsSection({ items }) {
  if (!items) return null;
  return (
    <Section tone="paper" eyebrow="Highlighted Projects" title="What our alumni have built together">
      {items.length === 0 && <p className="text-[var(--muted)]">Projects led by our alumni and batches will be highlighted here.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.slice(0, 6).map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card card-hover overflow-hidden block">
            {p.image && <img src={p.image} alt="" className="w-full aspect-[16/10] object-cover" loading="lazy" />}
            <div className="p-5">
              {p.batch_name && <p className="text-xs uppercase tracking-[0.14em] text-[var(--gold-deep)]">{p.batch_name}</p>}
              <h3 className="serif text-xl text-[var(--navy)] mt-1">{p.title}</h3>
              {p.summary && <p className="text-sm text-[var(--muted)] mt-2 line-clamp-3">{p.summary}</p>}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
