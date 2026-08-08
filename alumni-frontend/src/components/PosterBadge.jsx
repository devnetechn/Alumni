import { Crown } from 'lucide-react';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';

export default function PosterBadge({ name, email, pic, role, subtitle, date, size = 'md' }) {
  const display = name || email || 'Unknown';

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} email={email} pic={pic} size={size === 'sm' ? 'sm' : 'md'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[var(--brand-ink)] text-sm truncate">{display}</p>
          {role === 'admin' && <Badge tone="accent"><Crown size={10} /> ADMIN</Badge>}
        </div>
        {(subtitle || date) && (
          <p className="text-xs text-slate-500 truncate">
            {subtitle}{subtitle && date ? ' · ' : ''}{date}
          </p>
        )}
      </div>
    </div>
  );
}
