export default function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-[var(--paper-2)] text-[var(--navy)] border-[var(--line)]',
    accent: 'bg-[var(--gold)] text-[var(--navy)] border-[var(--gold)]',
    navy: 'bg-[var(--navy)] text-white border-[var(--navy)]',
    success: 'bg-[#E8F5EE] text-[#14633A] border-[#BFE3CF]',
    danger: 'bg-[#FDECEA] text-[#8F1C12] border-[#F3C4BF]',
    warning: 'bg-[#FFF6D6] text-[#6B4E00] border-[#F5DE8A]',
  };
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide flex-shrink-0 ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
