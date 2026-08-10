import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, HeartHandshake, Megaphone } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const WAYS = [
  { icon: GraduationCap, label: 'Scholarships' },
  { icon: Users, label: 'Mentorship' },
  { icon: HeartHandshake, label: 'Donations' },
  { icon: Megaphone, label: 'Outreach' },
];

export default function GiveBack() {
  return (
    <motion.section
      id="give-back"
      className="py-24 px-6"
      style={{ background: 'var(--editorial-beige)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-6">
          Give Back. Make an Impact.
        </h2>
        <p className="text-lg text-slate-600 leading-relaxed mb-10">
          Alumni support the school and community in more ways than one —
          through scholarships that open doors, mentorship that guides the
          next generation, donations that fund real change, and outreach
          that keeps the community strong.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
          {WAYS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-white border-2 border-[var(--brand-ink)]">
                <Icon size={22} className="text-[var(--brand-accent)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--brand-ink)]">{label}</p>
            </div>
          ))}
        </div>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-[var(--brand-accent)] text-white font-bold px-8 py-3 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] hover:opacity-90 transition-opacity"
        >
          Make a Difference →
        </Link>
      </div>
    </motion.section>
  );
}
