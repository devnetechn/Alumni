import { motion } from 'framer-motion';
import { Handshake, Building2 } from 'lucide-react';

const sectionFade = {
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

export default function Partnerships({ partners }) {
  if (partners.length === 0) return null;

  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <div className="flex items-center gap-3 mb-3">
        <Handshake className="text-[var(--brand-accent)]" size={26} />
        <h2 className="font-editorial text-3xl md:text-4xl text-[var(--brand-ink)]">Partnerships</h2>
      </div>
      <p className="text-slate-600 max-w-2xl mb-8">
        Together in the shared vision of a stronger, more connected alumni
        community, our partners help bring opportunities, resources, and
        support to graduates at every stage of their journey.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {partners.map((p, i) => {
          const card = (
            <motion.div
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className="aspect-square rounded-[var(--radius)] bg-[var(--brand-surface)] flex flex-col items-center justify-center gap-2 hover:shadow-md transition-shadow"
              title={p.name}
            >
              {p.logo ? (
                <img src={p.logo} alt={p.name} className="w-full h-full object-contain p-8" />
              ) : (
                <>
                  <Building2 className="text-slate-400" size={32} />
                  <p className="text-sm font-semibold text-slate-500 text-center px-3">{p.name}</p>
                </>
              )}
            </motion.div>
          );
          return p.website_url ? (
            <a key={p.id} href={p.website_url} target="_blank" rel="noreferrer">{card}</a>
          ) : (
            <div key={p.id}>{card}</div>
          );
        })}
      </div>
    </motion.section>
  );
}
