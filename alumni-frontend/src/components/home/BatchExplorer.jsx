import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.06, ease: 'easeOut' },
  }),
};

const BATCHES = [
  { range: '1990–1999', count: '420+', reunion: 'Silver Homecoming 2025' },
  { range: '2000–2009', count: '890+', reunion: 'Class of 2005 Reunion' },
  { range: '2010–2019', count: '1,340+', reunion: "Decade's End Gala" },
  { range: '2020–2026', count: '610+', reunion: 'Newest Grads Meetup' },
];

export default function BatchExplorer() {
  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-24"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">FIND YOUR YEARS</p>
      <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
        Explore Your Batch
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {BATCHES.map((b, i) => (
          <motion.div
            key={b.range}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardFade}
            className="group relative aspect-[3/4] rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)] cursor-default"
            style={{ background: 'var(--editorial-navy)' }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-editorial text-2xl md:text-3xl text-white text-center px-2">{b.range}</p>
            </div>
            <div className="absolute inset-0 bg-[var(--brand-ink)]/90 flex flex-col items-center justify-center gap-2 px-4 text-center opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="font-editorial text-3xl text-white">{b.count}</p>
              <p className="text-xs text-white/70 uppercase tracking-wider">Alumni</p>
              <p className="text-sm text-white/90 mt-2">{b.reunion}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-accent)] mt-2">
                Explore <ArrowRight size={12} />
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
