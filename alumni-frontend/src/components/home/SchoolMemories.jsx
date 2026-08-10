import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.05, ease: 'easeOut' },
  }),
};

const SPAN_PATTERN = ['row-span-2', 'row-span-1', 'row-span-1', 'row-span-2', 'row-span-1', 'row-span-1'];

export default function SchoolMemories({ highlights, onSelect }) {
  if (highlights.length === 0) return null;

  return (
    <motion.section
      id="memories"
      className="py-24 px-6"
      style={{ background: 'var(--editorial-gray)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">THE ARCHIVE</p>
        <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
          Moments We'll Always Remember
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 grid-flow-dense gap-3" style={{ gridAutoRows: '160px' }}>
          {highlights.map((h, i) => (
            <motion.button
              key={h.id}
              type="button"
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              onClick={() => onSelect(h)}
              className={`group relative rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)] hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow text-left ${SPAN_PATTERN[i % SPAN_PATTERN.length]}`}
            >
              {h.media_type === 'video' ? (
                <>
                  <video src={h.media} className="w-full h-full object-cover" preload="metadata" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Play className="text-white" fill="white" size={28} />
                  </div>
                </>
              ) : (
                <img src={h.media} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                {h.event_title} · {new Date(h.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
