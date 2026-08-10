import { motion } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const statFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.08, ease: 'easeOut' },
  }),
};

export default function AlumniImpact({ stats }) {
  const items = [
    { value: stats?.totalAlumni ? `${stats.totalAlumni}+` : '—', label: 'Alumni' },
    { value: '35+', label: 'Years of Community' },
    { value: '25', label: 'Active Batches' },
    { value: '50+', label: 'Annual Events' },
  ];

  return (
    <motion.section
      className="py-24 px-6 text-white"
      style={{ background: 'var(--editorial-navy)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {items.map((item, i) => (
          <motion.div key={item.label} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={statFade}>
            <p className="font-editorial text-5xl md:text-6xl mb-2">{item.value}</p>
            <p className="text-sm text-white/60 uppercase tracking-wider">{item.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
