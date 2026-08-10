import { motion } from 'framer-motion';
import heroPoster from '../../assets/hero.png';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export default function AlumniIntro() {
  return (
    <motion.section
      id="about"
      className="bg-white py-24 px-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)]">
          <img src={heroPoster} alt="" className="w-full h-full object-cover aspect-[4/3]" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-4">
            OUR COMMUNITY
          </p>
          <h2 className="font-editorial text-4xl md:text-5xl leading-tight text-[var(--brand-ink)] mb-6">
            Connected by memories. United by purpose.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            The Alumni Association exists to keep every graduate connected —
            to each other, to their school, and to the opportunities that
            come from staying in touch. Whether you graduated last year or
            decades ago, this is your space to reconnect, celebrate
            milestones, and give back to the community that shaped you.
          </p>
          <a href="#alumni" className="inline-flex items-center gap-2 font-bold text-[var(--brand-ink)] hover:text-[var(--brand-accent)] transition-colors">
            Learn More →
          </a>
        </div>
      </div>
    </motion.section>
  );
}
