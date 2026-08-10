import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Avatar from '../ui/Avatar';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.08, ease: 'easeOut' },
  }),
};

const ALUMNI = [
  {
    name: 'Maria Santos',
    year: 'Class of 2015',
    program: 'Entrepreneurship',
    quote: 'From campus dreams to building a business that creates opportunities for others.',
  },
  {
    name: 'Jon Dela Cruz',
    year: 'Class of 2012',
    program: 'Civil Engineering',
    quote: 'Every bridge I design carries a little of what I learned here.',
  },
  {
    name: 'Liza Fernandez',
    year: 'Class of 2018',
    program: 'Education',
    quote: 'Now teaching the next generation the same way I was taught.',
  },
];

export default function FeaturedAlumni() {
  return (
    <motion.section
      id="alumni"
      className="max-w-7xl mx-auto px-6 py-24"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">MEET OUR ALUMNI</p>
      <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
        Faces behind the stories.
      </h2>
      <div className="grid md:grid-cols-3 gap-8">
        {ALUMNI.map((a, i) => (
          <motion.div
            key={a.name}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardFade}
            className="group"
          >
            <div className="mb-5 flex justify-center">
              <Avatar name={a.name} size="lg" />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-[var(--brand-ink)]">{a.name}</p>
              <p className="text-sm text-slate-500 mb-3">{a.year} · {a.program}</p>
              <p className="text-slate-600 italic leading-relaxed mb-4">&ldquo;{a.quote}&rdquo;</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand-ink)] group-hover:text-[var(--brand-accent)] transition-colors cursor-default">
                Read Story <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
