import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section } from '../PageHeader';
import communityImg from '../../assets/community.jpg';

const DEFAULT_BODY =
  'This website is where our alumni find each other again. Every batch has its own community, every reunion has its own story, and every number below is proof that the family is alive and still growing.';

function Stat({ value, label }) {
  return (
    <div className="px-4 py-5 text-center">
      <p className="serif text-3xl text-[var(--gold-deep)]">{value ?? '—'}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
    </div>
  );
}

export default function Overview({ school }) {
  const title = school?.overview_title || 'Reconnecting our alumni, one batch at a time';
  const body = school?.overview_body || DEFAULT_BODY;

  return (
    <Section eyebrow="Our Story" title={title}>
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <img src={communityImg} alt="" className="w-full aspect-[4/3] object-cover rounded-[var(--radius)]" loading="lazy" />
        <div>
          <p className="text-[var(--muted)] leading-relaxed text-lg whitespace-pre-wrap">{body}</p>
          <Link to="/about" className="inline-flex items-center gap-2 mt-6 font-semibold text-[var(--navy)] border-b-2 border-[var(--gold)] pb-0.5">About the association <ArrowRight size={16} /></Link>
        </div>
      </div>
    </Section>
  );
}

export function StatsStrip({ stats }) {
  const n = (k) => (stats ? stats[k] : stats === false ? '—' : '…');
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 -mt-10">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--line)] border border-[var(--line)] border-t-2 border-t-[var(--gold)] rounded-[var(--radius)] bg-white shadow-lg" role="group" aria-label="Community statistics">
        <Stat value={n('batches')} label="Batches" />
        <Stat value={n('alumni')} label="Registered alumni" />
        <Stat value={n('upcoming_events')} label="Upcoming events" />
        <Stat value={n('communities')} label="Active communities" />
      </div>
    </div>
  );
}
