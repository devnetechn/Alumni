import { motion } from 'framer-motion';
import { Users, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import heroPoster from '../assets/hero.png';

// Swap point: once the real hero video is supplied, save it as
// src/assets/hero.mp4, then uncomment the import below and delete the
// `const heroVideoSrc = null;` line.
// import heroVideoSrc from '../assets/hero.mp4';
const heroVideoSrc = null;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: 'easeOut' },
  }),
};

export default function Hero({ stats }) {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      <div className="absolute inset-0">
        {heroVideoSrc ? (
          <video
            className="w-full h-full object-cover"
            src={heroVideoSrc}
            poster={heroPoster}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img src={heroPoster} alt="" className="w-full h-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, color-mix(in srgb, var(--brand-primary) 55%, transparent) 0%, color-mix(in srgb, var(--brand-primary) 75%, transparent) 60%, color-mix(in srgb, var(--brand-primary) 92%, transparent) 100%)',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-24 text-center text-white w-full">
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
        >
          <Sparkles size={14} />
          Reconnect. Network. Grow.
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="font-display text-5xl md:text-6xl font-semibold mb-6 leading-tight"
        >
          Welcome home,
          <br />
          <span style={{ color: 'var(--brand-accent)' }}>fellow alumni.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10"
        >
          Stay connected with your batchmates, discover upcoming events, and explore career
          opportunities — all in one place.
        </motion.p>

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
      </div>
    </section>
  );
}

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5">
      <Icon className="mx-auto mb-2 opacity-80" size={20} />
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs opacity-80 uppercase tracking-wider">{label}</p>
    </div>
  );
}
