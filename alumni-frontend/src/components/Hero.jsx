import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import heroPoster from '../assets/hero.png';
import heroVideoSrc from '../assets/hero.mp4';
import heroVideoWebm from '../assets/hero.webm';

// Skip the video for users who prefer reduced motion or have data saver on.
const showVideo =
  typeof window !== 'undefined' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !navigator.connection?.saveData;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, delay: i * 0.06, ease: 'easeOut' },
  }),
};

export default function Hero({ stats }) {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      <div className="absolute inset-0">
        {showVideo ? (
          <video
            className="w-full h-full object-cover"
            poster={heroPoster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={heroVideoWebm} type="video/webm" />
            <source src={heroVideoSrc} type="video/mp4" />
          </video>
        ) : (
          <img src={heroPoster} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-24 text-center text-white w-full">
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          className="inline-flex items-center gap-2 bg-[var(--brand-accent)] border border-white px-4 py-1.5 rounded-[var(--radius)] text-sm font-bold mb-6 text-[var(--navy)]"
        >
          <Sparkles size={14} />
          Reconnect. Network. Grow.
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="font-editorial text-5xl md:text-6xl mb-6 leading-tight"
        >
          Where Every Journey Begins,
          <br />
          and Every Story Continues.
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10"
        >
          Reconnect with the people, memories, and community that make our
          alumni family special.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={2.5}
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-4 mb-10"
        >
          <a
            href="#alumni"
            className="inline-flex items-center gap-2 bg-[var(--brand-accent)] text-[var(--navy)] font-bold px-6 py-3 rounded-[var(--radius)] border border-white hover:opacity-90 transition-opacity"
          >
            Explore Our Alumni Community
          </a>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-transparent text-white font-bold px-6 py-3 rounded-[var(--radius)] border border-white/60 hover:border-white transition-colors"
          >
            Join the Alumni Association
          </Link>
        </motion.div>

        {stats && (
          <motion.div
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
            className="grid grid-cols-3 gap-4 max-w-2xl mx-auto"
          >
            <StatBox icon={Users} label="Alumni" value={stats.totalAlumni} />
            <StatBox icon={Calendar} label="Events" value={stats.totalEvents} />
            <StatBox icon={CheckCircle2} label="Check-ins" value={stats.totalCheckins} />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border border-white/50 flex items-start justify-center p-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/10 border border-white/40 rounded-[var(--radius)] p-5">
      <Icon className="mx-auto mb-2 opacity-90" size={20} />
      <p className="font-display text-3xl">{value}</p>
      <p className="text-xs opacity-80 uppercase tracking-wider">{label}</p>
    </div>
  );
}
