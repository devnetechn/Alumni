import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, Calendar, CheckCircle2, Megaphone, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';

export default function PublicHome() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/announcements').then((r) => setAnnouncements(r.data.announcements));
    api.get('/events').then((r) => setEvents(r.data.events));
    api.get('/stats').then((r) => setStats(r.data));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
              <GraduationCap className="text-white" size={22} />
            </div>
            <span className="font-bold text-slate-900">Alumni System</span>
          </Link>
          <div className="flex gap-2">
            {user ? (
              <Link to="/dashboard" className="px-5 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors text-sm">
                Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 text-slate-700 hover:text-slate-900 font-semibold text-sm">
                  Login
                </Link>
                <Link to="/register" className="px-5 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors text-sm">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-7xl mx-auto px-6 py-24 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Sparkles size={14} />
            Reconnect. Network. Grow.
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
            Welcome home,<br />
            <span className="bg-gradient-to-r from-amber-200 to-pink-200 bg-clip-text text-transparent">
              fellow alumni.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10">
            Stay connected with your batchmates, discover upcoming events, and explore career opportunities — all in one place.
          </p>

          {stats && (
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              <StatBox icon={Users} label="Alumni" value={stats.totalAlumni} />
              <StatBox icon={Calendar} label="Events" value={stats.totalEvents} />
              <StatBox icon={CheckCircle2} label="Check-ins" value={stats.totalCheckins} />
            </div>
          )}
        </div>
      </section>

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

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5">
      <Icon className="mx-auto mb-2 opacity-80" size={20} />
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs opacity-80 uppercase tracking-wider">{label}</p>
    </div>
  );
}
