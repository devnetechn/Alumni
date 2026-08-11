import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import Avatar from '../ui/Avatar';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

// Placeholder content — replace with the real president's name, title,
// message, and photo (pass `pic` to <Avatar> once a photo exists).
const PRESIDENT_NAME = 'Juan Dela Cruz';
const PRESIDENT_TITLE = 'President, IHES Alumni Association';
const PRESIDENT_MESSAGE =
  "Every year, I'm reminded that this association isn't really about " +
  'reunions or events — it\'s about the friendships and support that never ' +
  'stopped, no matter how far apart life has taken us. Wherever you are ' +
  'now, know that you always have a home here, among people who remember ' +
  'where you started.';

export default function PresidentMessage() {
  return (
    <motion.section
      className="bg-[var(--brand-ink)] py-24 px-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeIn}
    >
      <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_auto] gap-12 items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-6">
            A WORD FROM OUR PRESIDENT
          </p>
          <Quote className="mb-6 text-[var(--brand-accent)]" size={36} strokeWidth={2.5} />
          <p className="font-editorial italic text-2xl md:text-3xl leading-snug text-white">
            {PRESIDENT_MESSAGE}
          </p>
        </div>
        <div className="flex flex-col items-center text-center gap-3">
          <Avatar name={PRESIDENT_NAME} size="lg" />
          <div>
            <p className="font-bold text-white">{PRESIDENT_NAME}</p>
            <p className="text-sm text-white/60">{PRESIDENT_TITLE}</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
