import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, X, LogIn, UserPlus, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useAuth } from '../auth';
import Hero from '../components/Hero';
import AlumniIntro from '../components/home/AlumniIntro';
import PresidentMessage from '../components/home/PresidentMessage';
import FeaturedAlumni from '../components/home/FeaturedAlumni';
import AlumniStories from '../components/home/AlumniStories';
import AnnouncementsSection from '../components/home/AnnouncementsSection';
import AlumniEventsSection from '../components/home/AlumniEventsSection';
import BatchExplorer from '../components/home/BatchExplorer';
import SchoolMemories from '../components/home/SchoolMemories';
import AlumniImpact from '../components/home/AlumniImpact';
import OfficersPreview from '../components/home/OfficersPreview';
import Partnerships from '../components/home/Partnerships';
import GiveBack from '../components/home/GiveBack';
import ChatWidget from '../components/ChatWidget';
import { Button, Wordmark } from '../components/ui';

const sectionFade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export default function PublicHome() {
  const { user, school } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [partners, setPartners] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    ['Home', '#'],
    ['About', '#about'],
    ['Alumni', '#alumni'],
    ['Officers', '/officers'],
    ['Stories', '#stories'],
    ['Events', '#events'],
    ['Memories', '#memories'],
    ['Give Back', '#give-back'],
  ];

  useEffect(() => {
    api.get('/announcements').then((r) => setAnnouncements(r.data.announcements));
    api.get('/events').then((r) => setEvents(r.data.events));
    api.get('/stats').then((r) => setStats(r.data));
    api.get('/events/highlights').then((r) => setHighlights(r.data.highlights));
    api.get('/partners').then((r) => setPartners(r.data.partners));
    api.get('/officers').then((r) => setOfficers(r.data.officers));
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
              <img src={school.logo} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="p-2 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-white">
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <Wordmark className="text-white" />
          </Link>
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(([label, href]) =>
                href.startsWith('#') ? (
                  <a key={label} href={href} className="text-sm font-semibold text-white/80 hover:text-white transition-colors">
                    {label}
                  </a>
                ) : (
                  <Link key={label} to={href} className="text-sm font-semibold text-white/80 hover:text-white transition-colors">
                    {label}
                  </Link>
                )
              )}
            </nav>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="md:hidden p-2.5 rounded-[var(--radius)] border-2 border-transparent hover:border-white/40 text-white"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              {user ? (
                <Link to="/dashboard">
                  <Button variant="primary">Dashboard →</Button>
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    title="Login"
                    className="p-2.5 rounded-[var(--radius)] border-2 border-transparent hover:border-white/40 text-white/90 hover:text-white transition-colors"
                  >
                    <LogIn size={18} />
                  </Link>
                  <Link
                    to="/register"
                    title="Register"
                    className="p-2.5 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-white text-white hover:opacity-90 transition-opacity"
                  >
                    <UserPlus size={18} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[var(--brand-ink)] border-t-2 border-white/10 px-6 py-4">
            <nav className="flex flex-col gap-1">
              {navLinks.map(([label, href]) =>
                href.startsWith('#') ? (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 text-sm font-semibold text-white/80 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                ) : (
                  <Link
                    key={label}
                    to={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 text-sm font-semibold text-white/80 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                )
              )}
            </nav>
          </div>
        )}
      </header>

      <Hero stats={stats} />

      <AlumniIntro />

      <PresidentMessage />

      <FeaturedAlumni />

      <AlumniStories />

      <AnnouncementsSection announcements={announcements} />

      <AlumniEventsSection events={events} />

      <BatchExplorer />

      <SchoolMemories highlights={highlights} onSelect={setLightbox} />

      <AlumniImpact stats={stats} />

      <OfficersPreview officers={officers} />

      <Partnerships partners={partners} />

      <GiveBack />

      {/* Join CTA */}
      <motion.section
        className="max-w-7xl mx-auto px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={sectionFade}
      >
        <div className="bg-[var(--brand-ink)] border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-12 text-center text-white">
          <h2 className="font-editorial text-4xl md:text-5xl mb-4">Your Story Is Part of Our Story.</h2>
          <p className="text-white/70 mb-8 text-lg max-w-xl mx-auto">
            Stay connected, meet fellow alumni, and continue making a difference in the community.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {!user && (
              <Link to="/register">
                <Button variant="primary">
                  Join the Alumni Network
                  <ArrowRight size={18} />
                </Button>
              </Link>
            )}
            {user && (
              <Link to="/profile">
                <Button variant="primary">
                  Update Your Profile
                  <ArrowRight size={18} />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.section>

      <footer className="border-t-[2.5px] border-[var(--brand-ink)] py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} IHES Alumni Association. Built for lifelong connections.
        </div>
      </footer>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white p-2"
            >
              <X size={24} />
            </button>
            {lightbox.media_type === 'video' ? (
              <video src={lightbox.media} className="w-full rounded-[var(--radius)]" controls autoPlay />
            ) : (
              <img src={lightbox.media} alt="" className="w-full rounded-[var(--radius)]" />
            )}
            <p className="text-white text-sm mt-3 text-center">
              {lightbox.event_title} · {new Date(lightbox.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  );
}
