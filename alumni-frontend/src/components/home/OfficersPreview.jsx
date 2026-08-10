import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ArrowRight } from 'lucide-react';
import Avatar from '../ui/Avatar';

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

export default function OfficersPreview({ officers }) {
  if (officers.length === 0) return null;
  const preview = officers.slice(0, 4);

  return (
    <motion.section
      id="officers"
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="text-[var(--brand-accent)]" size={26} />
          <h2 className="font-editorial text-3xl md:text-4xl text-[var(--brand-ink)]">Officers & Board</h2>
        </div>
        <Link to="/officers" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand-accent)] hover:underline">
          See all officers <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {preview.map((o, i) => (
          <motion.div
            key={o.id}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardFade}
            className="bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-6 text-center hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
          >
            <div className="flex justify-center mb-4">
              <Avatar name={o.name} pic={o.photo} size="lg" />
            </div>
            <p className="font-bold text-[var(--brand-ink)]">{o.name}</p>
            <p className="text-sm text-slate-500">{o.position}</p>
          </motion.div>
        ))}
      </div>
      <Link to="/officers" className="sm:hidden mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand-accent)] hover:underline">
        See all officers <ArrowRight size={14} />
      </Link>
    </motion.section>
  );
}
