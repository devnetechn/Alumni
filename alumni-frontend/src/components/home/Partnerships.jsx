import { Section } from '../PageHeader';

function Logo({ partner }) {
  const inner = partner.logo
    ? <img src={partner.logo} alt={partner.name} className="max-h-16 max-w-full object-contain" loading="lazy" />
    : <span className="serif text-lg text-[var(--navy)] text-center">{partner.name}</span>;
  const box = 'h-28 flex items-center justify-center p-4 border border-[var(--line)] rounded-[var(--radius)] bg-white';
  return partner.website_url ? (
    <a href={partner.website_url} target="_blank" rel="noopener noreferrer" aria-label={`${partner.name} (opens in a new tab)`} className={`${box} hover:border-[var(--gold)] transition-colors`}>{inner}</a>
  ) : (
    <div className={box}>{inner}</div>
  );
}

export default function Partnerships({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <Section eyebrow="Partnership" title="Organizations that stand with us">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((p) => <Logo key={p.id} partner={p} />)}
      </div>
    </Section>
  );
}
