import { motion } from 'framer-motion';
import { Megaphone } from 'lucide-react';
import PosterBadge from '../PosterBadge';
import { Panel } from '../ui';

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

export default function AnnouncementsSection({ announcements }) {
  return (
    <motion.section
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <div className="flex items-center gap-3 mb-8">
        <Megaphone className="text-[var(--brand-accent)]" size={26} />
        <h2 className="font-editorial text-3xl md:text-4xl text-[var(--brand-ink)]">
          Latest Announcements
        </h2>
      </div>
      {announcements.length === 0 ? (
        <Panel className="p-8 text-slate-500">No announcements yet.</Panel>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {announcements.map((a, i) => (
            <motion.article
              key={a.id}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-6 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow min-w-0"
            >
              <div className="mb-4">
                <PosterBadge
                  name={a.poster_name}
                  email={a.poster_email}
                  pic={a.poster_pic}
                  role={a.poster_role}
                  subtitle={a.poster_position}
                  date={new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  size="sm"
                />
              </div>
              <h3 className="font-display text-xl mb-2 text-[var(--brand-ink)]">
                {a.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">{a.body}</p>
            </motion.article>
          ))}
        </div>
      )}
    </motion.section>
  );
}
