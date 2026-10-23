import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { api } from '../api';
import { Section, Empty, Loading } from '../components/PageHeader';

export default function AnnouncementDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get(`/announcements/${id}`).then((r) => setItem(r.data.announcement)).catch(() => setMissing(true));
  }, [id]);

  if (missing) return <Section><Empty title="Announcement not found">It may have been removed. <Link to="/" className="underline">Back to home</Link></Empty></Section>;
  if (!item) return <Section><Loading /></Section>;

  const agenda = item.agenda || [];
  return (
    <Section eyebrow="Announcement" title={item.title}>
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)] mb-6"><ArrowLeft size={16} /> Back to home</Link>
      <p className="text-xs text-[var(--muted)] mb-4">
        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        {item.poster_name ? ` · Posted by ${item.poster_name}` : ''}
      </p>
      {item.body && <p className="text-[var(--text)] leading-relaxed whitespace-pre-wrap max-w-3xl">{item.body}</p>}
      {agenda.length > 0 && (
        <div className="mt-10 max-w-3xl">
          <h2 className="serif text-2xl text-[var(--navy)] mb-4">Agenda</h2>
          <ol className="border-l-2 border-[var(--gold)] space-y-4 pl-6">
            {agenda.map((row, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-[var(--gold)]" aria-hidden="true" />
                {row.time && <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-deep)] flex items-center gap-1"><Clock size={12} aria-hidden="true" /> {row.time}</p>}
                <p className="text-[var(--text)]">{row.activity}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Section>
  );
}
