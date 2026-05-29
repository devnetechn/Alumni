import { Crown } from 'lucide-react';

export default function PosterBadge({ name, email, pic, role, subtitle, date, size = 'md' }) {
  const display = name || email || 'Unknown';
  const initial = display[0].toUpperCase();
  const dim = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';

  return (
    <div className="flex items-center gap-3">
      <div className={`${dim} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}>
        {pic ? <img src={pic} alt="" className="w-full h-full object-cover" /> : initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-slate-900 text-sm truncate">{display}</p>
          {role === 'admin' && (
            <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              <Crown size={10} /> ADMIN
            </span>
          )}
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
