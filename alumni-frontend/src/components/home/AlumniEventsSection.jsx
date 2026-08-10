import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
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

export default function AlumniEventsSection({ events }) {
  return (
    <motion.section
      id="events"
      className="max-w-7xl mx-auto px-6 py-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionFade}
    >
      <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">UPCOMING</p>
      <h2 className="font-editorial text-3xl md:text-4xl text-[var(--brand-ink)] mb-8">
        Reconnect. Celebrate. Belong.
      </h2>
      {events.length === 0 ? (
        <Panel className="p-8 text-slate-500">No events scheduled yet.</Panel>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {events.map((ev, i) => (
            <motion.div
              key={ev.id}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] overflow-hidden hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
            >
              <div className="p-6 text-white" style={{ background: 'var(--editorial-navy)' }}>
                <div className="text-xs uppercase tracking-wider opacity-70 mb-1">
                  {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="font-editorial text-3xl">
                  {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-sm opacity-70">
                  {new Date(ev.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2 text-[var(--brand-ink)]">
                  {ev.title}
                </h3>
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                    <MapPin size={14} />
                    {ev.location}
                  </div>
                )}
                <p className="text-sm text-slate-600 line-clamp-2">{ev.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}
