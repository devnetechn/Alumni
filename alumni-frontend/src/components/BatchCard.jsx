import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Avatar } from './ui';

export default function BatchCard({ batch }) {
  return (
    <Link to={`/batches/${batch.id}`} className="card card-hover overflow-hidden group block">
      <div className="relative h-40 bg-[var(--navy)] overflow-hidden">
        {batch.cover_image && <img src={batch.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy)] via-[var(--navy)]/60 to-[var(--navy)]/30" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="eyebrow !text-[var(--gold)]">Class of</p>
          <p className="serif text-4xl text-white leading-none mt-1">{batch.year}</p>
        </div>
        <span className="absolute left-5 right-5 bottom-0 h-0.5 bg-[var(--gold)]" />
      </div>
      <div className="p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {batch.president_name ? <Avatar name={batch.president_name} pic={batch.president_pic} size="sm" /> : null}
          <div className="min-w-0">
            <p className="text-xs text-[var(--muted)]">President</p>
            <p className="text-sm font-semibold text-[var(--navy)] truncate">{batch.president_name || 'Not yet assigned'}</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-[var(--muted)] shrink-0"><Users size={15} aria-hidden="true" />{batch.member_count}</p>
      </div>
    </Link>
  );
}
