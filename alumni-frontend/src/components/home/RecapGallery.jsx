import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { api } from '../../api';
import { Section } from '../PageHeader';

// Recap of the latest public event, plus a gallery that can be filtered per batch.
export default function RecapGallery({ recap, batches, onOpen }) {
  const [batchId, setBatchId] = useState('');
  const [photos, setPhotos] = useState(null);
  const [hasAny, setHasAny] = useState(false);

  useEffect(() => {
    let live = true;
    api.get('/batch-gallery', { params: batchId ? { batch_id: batchId } : {} })
      .then((r) => {
        if (!live) return;
        setPhotos(r.data.photos.slice(0, 12));
        if (!batchId && r.data.photos.length > 0) setHasAny(true);
      })
      .catch(() => live && setPhotos([]));
    return () => { live = false; };
  }, [batchId]);

  const event = recap?.event;
  if (!event && !hasAny && photos !== null && !batchId) return null;
  if (!event && photos === null) return null;

  return (
    <Section eyebrow="Wrap-up" title="Moments we shared">
      {event && (
        <div className="mb-12">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Our latest event</p>
              <h3 className="serif text-2xl text-[var(--navy)]">{event.title}</h3>
              <p className="text-sm text-[var(--muted)] mt-1 inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden="true" />
                {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <Link to={`/events/${event.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">See the recap <ArrowRight size={16} /></Link>
          </div>
          <Link to={`/events/${event.id}`} className="grid grid-cols-2 md:grid-cols-3 gap-3" aria-label={`Open recap of ${event.title}`}>
            {recap.photos.map((p) => (
              <div key={p.id} className="aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-[var(--paper-2)]">
                {p.media_type === 'video'
                  ? <video src={p.media} className="w-full h-full object-cover" muted />
                  : <img src={p.media} alt={event.title} className="w-full h-full object-cover" loading="lazy" />}
              </div>
            ))}
          </Link>
        </div>
      )}

      {(hasAny || batchId) && (
        <div>
          <h3 className="serif text-2xl text-[var(--navy)] mb-4">Gallery by batch</h3>
          <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter gallery by batch">
            {[{ id: '', name: 'All batches' }, ...(batches || [])].map((b) => {
              const active = String(b.id) === batchId;
              return (
                <button
                  key={b.id}
                  onClick={() => setBatchId(String(b.id))}
                  aria-pressed={active}
                  className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${active ? 'bg-[var(--navy)] text-white border-[var(--navy)]' : 'bg-white text-[var(--navy)] border-[var(--line)] hover:border-[var(--navy)]'}`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
          {photos && photos.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No photos for this batch yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(photos || []).map((p) => (
                <button key={p.id} onClick={() => onOpen({ media: p.media, media_type: 'image', event_title: p.caption || p.batch_name })} className="group aspect-square overflow-hidden rounded-[var(--radius)] bg-[var(--paper-2)]" aria-label={`Open photo from ${p.batch_name}`}>
                  <img src={p.media} alt={p.caption || p.batch_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
