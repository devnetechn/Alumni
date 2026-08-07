import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Megaphone, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import Hero from '../components/Hero';

// Swap point: once the real school logo is supplied, save it as
// src/assets/logo.svg, then uncomment the import below and delete the
// `const logo = null;` line.
// import logo from '../assets/logo.svg';
const logo = null;

const sectionFade = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: 'easeOut' },
  }),
};

export default function PublicHome() {
  const { user } = useAuth();
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
    <div className="min-h-screen" style={{ background: 'var(--brand-cream)' }}>
      {/* Top bar */}
      <header
        className={`fixed top-0 left-0 right-0 z-20 transition-colors duration-300 border-b ${
          scrolled ? 'backdrop-blur-lg' : 'border-transparent'
        }`}
        style={
          scrolled
            ? { background: 'color-mix(in srgb, var(--brand-primary) 75%, transparent)', borderColor: 'rgba(255,255,255,0.1)' }
            : undefined
        }
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="Alumni logo" className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <div className="p-2 rounded-lg" style={{ background: 'var(--brand-secondary)' }}>
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <span className="font-display font-semibold text-white">Alumni System</span>
          </Link>
          <div className="flex gap-2">
            {user ? (
              <Link
                to="/dashboard"
                className="px-5 py-2 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm"
                style={{ background: 'var(--brand-secondary)' }}
              >
                Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 text-white/90 hover:text-white font-semibold text-sm">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm"
                  style={{ background: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
                >
                  Register
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
          <div
            className="p-2 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--brand-accent) 18%, white)' }}
          >
            <Megaphone style={{ color: 'var(--brand-secondary)' }} size={22} />
          </div>
          <h2 className="font-display text-3xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Latest Announcements
          </h2>
        </div>
        {announcements.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border" style={{ borderColor: 'color-mix(in srgb, var(--brand-accent) 30%, white)' }}>No announcements yet.</p>
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
                className="group bg-white p-6 rounded-2xl border hover:shadow-lg transition-shadow"
                style={{ borderColor: 'color-mix(in srgb, var(--brand-accent) 30%, white)' }}
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
                <h3 className="font-display text-xl font-semibold mb-2" style={{ color: 'var(--brand-primary)' }}>
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
          <div
            className="p-2 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--brand-secondary) 15%, white)' }}
          >
            <Calendar style={{ color: 'var(--brand-secondary)' }} size={22} />
          </div>
          <h2 className="font-display text-3xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Upcoming Events
          </h2>
        </div>
        {events.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border" style={{ borderColor: 'color-mix(in srgb, var(--brand-accent) 30%, white)' }}>No events scheduled yet.</p>
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
                className="group bg-white rounded-2xl overflow-hidden border hover:shadow-xl transition-shadow"
                style={{ borderColor: 'color-mix(in srgb, var(--brand-accent) 30%, white)' }}
              >
                <div
                  className="p-6 text-white"
                  style={{ background: 'linear-gradient(135deg, var(--brand-secondary), var(--brand-primary))' }}
                >
                  <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="text-3xl font-display font-semibold">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-sm opacity-80">
                    {new Date(ev.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--brand-primary)' }}>
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
          <div
            className="rounded-3xl p-12 text-center text-white"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}
          >
            <h2 className="font-display text-4xl font-semibold mb-4">Ready to reconnect?</h2>
            <p className="text-white/80 mb-8 text-lg">Join thousands of alumni in our growing network.</p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              style={{ background: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
            >
              Create Your Account
              <ArrowRight size={18} />
            </Link>
          </div>
        </motion.section>
      )}

      <footer className="border-t py-8 mt-8" style={{ borderColor: 'color-mix(in srgb, var(--brand-accent) 30%, white)' }}>
        <div className="max-w-7xl mx-auto px-6 text-center text-sm" style={{ color: 'color-mix(in srgb, var(--brand-primary) 55%, transparent)' }}>
          © {new Date().getFullYear()} Alumni Management System. Built with ❤️ for lifelong connections.
        </div>
      </footer>
    </div>
  );
}
