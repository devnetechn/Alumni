import { useEffect, useState } from 'react';
import { api } from '../api';
import PageHeader, { Section, Empty, Loading } from '../components/PageHeader';
import Lightbox from '../components/Lightbox';
import communityImg from '../assets/community.jpg';

export default function Gallery() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { api.get('/events/highlights').then((r) => setItems(r.data.highlights)).catch(() => setItems([])); }, []);

  return (
    <>
      <PageHeader eyebrow="Gallery" title="Moments we shared" image={communityImg}>
        Photographs and videos from association events. Batch-private photos stay inside their communities.
      </PageHeader>
      <Section>
        {items === null ? <Loading /> : items.length === 0 ? (
          <Empty title="The gallery is empty">Photos from past events will be published here by the association.</Empty>
        ) : (
          <ul className="columns-2 md:columns-3 gap-3 [&>li]:mb-3">
            {items.map((h) => (
              <li key={h.id} className="break-inside-avoid">
                <button onClick={() => setOpen(h)} className="group block w-full overflow-hidden rounded-[var(--radius)] bg-[var(--paper-2)]" aria-label={`Open ${h.event_title}`}>
                  {h.media_type === 'video' ? <video src={h.media} className="w-full" muted /> : <img src={h.media} alt={h.event_title} className="w-full transition-transform duration-500 group-hover:scale-105" loading="lazy" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {open && <Lightbox item={open} onClose={() => setOpen(null)} />}
    </>
  );
}
