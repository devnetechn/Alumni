import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Megaphone, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import Hero from '../components/Hero';
import { Panel, Button, Wordmark } from '../components/ui';

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

export default function PublicHome() {
  const { user, school } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api.get('/announcements').then((r) => setAnnouncements(r.data.announcements));
    api.get('/events').then((r) => setEvents(r.data.events));
    api.get('/stats').then((r) => setStats(r.data));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-bg)' }}>
      {/* Top bar */}
      <header
        className={`fixed top-0 left-0 right-0 z-20 transition-colors duration-300 border-b-[2.5px] ${
          scrolled ? 'bg-[var(--brand-ink)] border-[var(--brand-ink)]' : 'border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            {school?.logo ? (
              <img src={school.logo} alt="" className="h-9 w-9 rounded-[var(--radius)] border-2 border-white object-cover" />
            ) : (
              <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-white">
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <Wordmark className="text-white" />
          </Link>
          <div className="flex gap-2 items-center">
            {user ? (
              <Link to="/dashboard">
                <Button variant="primary">Dashboard →</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 text-white/90 hover:text-white font-bold text-sm">
                  Login
                </Link>
                <Link to="/register">
                  <Button variant="primary">Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <Hero stats={stats} />

      {/* Announcements */}
      <motion.section
        className="max-w-7xl mx-auto px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionFade}
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)]">
            <Megaphone className="text-white" size={22} />
          </div>
          <h2 className="font-display text-3xl text-[var(--brand-ink)]">
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
                className="group bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-6 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
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

      {/* Events */}
      <motion.section
        className="max-w-7xl mx-auto px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionFade}
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)]">
            <Calendar className="text-white" size={22} />
          </div>
          <h2 className="font-display text-3xl text-[var(--brand-ink)]">
            Upcoming Events
          </h2>
        </div>
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
                <div className="p-6 text-white bg-[var(--brand-ink)]">
                  <div className="text-xs uppercase tracking-wider opacity-70 mb-1">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="font-display text-3xl">
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

      {/* CTA */}
      {!user && (
        <motion.section
          className="max-w-7xl mx-auto px-6 py-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFade}
        >
          <div className="bg-[var(--brand-ink)] border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-12 text-center text-white">
            <h2 className="font-display text-4xl mb-4">Ready to reconnect?</h2>
            <p className="text-white/70 mb-8 text-lg">Join thousands of alumni in our growing network.</p>
            <Link to="/register">
              <Button variant="primary">
                Create Your Account
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </motion.section>
      )}

      <footer className="border-t-[2.5px] border-[var(--brand-ink)] py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} IHES Alumni Association. Built for lifelong connections.
        </div>
      </footer>
    </div>
  );
}
