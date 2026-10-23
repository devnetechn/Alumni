export default function Avatar({ name, email, pic, size = 'md', className = '' }) {
  const display = name || email || '?';
  const initial = display[0].toUpperCase();
  const dims = { xs: 'w-7 h-7 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-20 h-20 text-3xl', xl: 'w-28 h-28 text-4xl' };
  return (
    <div className={`${dims[size]} rounded-full bg-[var(--navy-2)] ring-1 ring-[var(--gold)]/60 flex items-center justify-center text-[var(--gold)] font-semibold flex-shrink-0 overflow-hidden ${className}`}>
      {pic ? <img src={pic} alt={name ? `${name}` : ''} className="w-full h-full object-cover" /> : <span aria-hidden="true">{initial}</span>}
    </div>
  );
}
