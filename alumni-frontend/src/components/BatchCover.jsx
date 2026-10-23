import { Users } from 'lucide-react';
import { Avatar } from './ui';

export default function BatchCover({ batch, children }) {
  return (
    <section className="relative bg-[var(--navy)] text-white on-dark overflow-hidden">
      {batch.cover_image && <img src={batch.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--navy)] via-[var(--navy)]/85 to-[var(--navy-2)]/70" />
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--gold)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <p className="eyebrow mb-3">Class of {batch.year}</p>
          <h1 className="serif text-4xl md:text-6xl leading-none">{batch.name}</h1>
          <span className="gold-rule mt-6" />
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/85">
            <span className="flex items-center gap-2"><Users size={16} className="text-[var(--gold)]" aria-hidden="true" />{batch.member_count} approved {batch.member_count === 1 ? 'member' : 'members'}</span>
            <span className="flex items-center gap-2.5">
              <Avatar name={batch.president_name} pic={batch.president_pic} size="sm" />
              <span><span className="text-white/60">President · </span>{batch.president_name || 'Not yet assigned'}</span>
            </span>
          </div>
        </div>
        {children && <div className="flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
