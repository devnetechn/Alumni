import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Lightbox({ item, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={item.event_title} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} onClick={onClose} aria-label="Close" className="absolute -top-11 right-0 text-white p-2"><X size={24} /></button>
        {item.media_type === 'video'
          ? <video src={item.media} className="w-full max-h-[80vh] rounded-[var(--radius)]" controls autoPlay />
          : <img src={item.media} alt={item.event_title} className="w-full max-h-[80vh] object-contain rounded-[var(--radius)]" />}
        <p className="text-white/80 text-sm mt-3 text-center">
          {item.event_title} · {new Date(item.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
