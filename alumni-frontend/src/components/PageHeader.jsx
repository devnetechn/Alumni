export default function PageHeader({ eyebrow, title, children, image }) {
  return (
    <section className="relative bg-[var(--navy)] text-white on-dark overflow-hidden">
      {image && <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--navy)] via-[var(--navy)]/85 to-[var(--navy-2)]/60" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="serif text-4xl md:text-5xl leading-tight max-w-3xl">{title}</h1>
        <span className="gold-rule mt-5" />
        {children && <div className="mt-5 text-white/75 max-w-2xl leading-relaxed">{children}</div>}
      </div>
    </section>
  );
}

export function Section({ eyebrow, title, action, children, className = '', tone = 'white' }) {
  return (
    <section className={`${tone === 'paper' ? 'bg-[var(--paper-2)]' : 'bg-white'} ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        {(title || eyebrow) && (
          <div className="flex items-end justify-between gap-4 mb-10">
            <div>
              {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
              <h2 className="serif text-3xl md:text-4xl text-[var(--navy)]">{title}</h2>
              <span className="gold-rule mt-4" />
            </div>
            {action}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="border border-dashed border-[#C7CDD6] rounded-[var(--radius)] bg-white px-6 py-12 text-center">
      <p className="serif text-xl text-[var(--navy)]">{title}</p>
      {children && <div className="mt-2 text-sm text-[var(--muted)] max-w-md mx-auto">{children}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading' }) {
  return <p role="status" className="py-16 text-center text-sm text-[var(--muted)]">{label}…</p>;
}
