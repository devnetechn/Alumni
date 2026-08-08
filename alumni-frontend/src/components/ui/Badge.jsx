export default function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-white text-[var(--brand-ink)]',
    accent: 'bg-[var(--brand-accent)] text-white',
    success: 'bg-[var(--brand-success)] text-white',
    danger: 'bg-[var(--brand-danger)] text-white',
    warning: 'bg-[#ffd23f] text-[var(--brand-ink)]',
  };
  return (
    <span className={`inline-flex items-center gap-1 border-2 border-[var(--brand-ink)] rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
