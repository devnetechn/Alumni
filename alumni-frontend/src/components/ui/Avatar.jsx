export default function Avatar({ name, email, pic, size = 'md' }) {
  const display = name || email || '?';
  const initial = display[0].toUpperCase();
  const dims = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-20 h-20 text-3xl' };
  return (
    <div className={`${dims[size]} rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}>
      {pic ? <img src={pic} alt="" className="w-full h-full object-cover" /> : initial}
    </div>
  );
}
