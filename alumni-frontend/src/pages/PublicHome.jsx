import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Megaphone, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import Hero from '../components/Hero';

// Swap point: once the real school logo is supplied, save it as
// src/assets/logo.svg and uncomment the two lines below.
// import logo from '../assets/logo.svg';
const logo = null;

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
    window.addEventListener('scroll', onScroll);
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
            ? { background: 'rgba(43,33,24,0.75)', borderColor: 'rgba(255,255,255,0.1)' }
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
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Megaphone className="text-indigo-600" size={22} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Latest Announcements</h2>
        </div>
        {announcements.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200">No announcements yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {announcements.map((a) => (
              <article key={a.id} className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all">
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
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{a.title}</h3>
                <p className="text-slate-600 leading-relaxed">{a.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Events */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Calendar className="text-purple-600" size={22} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Upcoming Events</h2>
        </div>
        {events.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200">No events scheduled yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {events.map((ev) => (
              <div key={ev.id} className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl transition-all">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
                  <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="text-3xl font-bold">
                    {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-sm opacity-80">
                    {new Date(ev.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{ev.title}</h3>
                  {ev.location && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                      <MapPin size={14} />
                      {ev.location}
                    </div>
                  )}
                  <p className="text-sm text-slate-600 line-clamp-2">{ev.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      {!user && (
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Ready to reconnect?</h2>
            <p className="text-slate-300 mb-8 text-lg">Join thousands of alumni in our growing network.</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors">
              Create Your Account
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-200 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Alumni Management System. Built with ❤️ for lifelong connections.
        </div>
      </footer>
    </div>
  );
}
