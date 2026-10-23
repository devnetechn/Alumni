import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, Users, Megaphone } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/ui';
import { Section, Empty } from '../components/PageHeader';
import BatchCard from '../components/BatchCard';
import EventCard from '../components/EventCard';
import Lightbox from '../components/Lightbox';
import ChatWidget from '../components/ChatWidget';
import heroImg from '../assets/hero.png';
import communityImg from '../assets/community.jpg';
import heroVideoMp4 from '../assets/hero.mp4';
import heroVideoWebm from '../assets/hero.webm';

// Skip the video for users who prefer reduced motion or have data saver on.
const showVideo =
  typeof window !== 'undefined' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !navigator.connection?.saveData;

function Stat({ value, label }) {
  return (
    <div className="px-4 py-6 text-center">
      <p className="serif text-4xl text-[var(--gold)]">{value ?? '—'}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/70">{label}</p>
    </div>
  );
}

export default function PublicHome() {
  const { user, school } = useAuth();
  const [stats, setStats] = useState(null);
  const [batches, setBatches] = useState(null);
  const [events, setEvents] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api.get('/public-stats').then((r) => setStats(r.data)).catch(() => setStats(false));
    api.get('/batches').then((r) => setBatches(r.data.batches)).catch(() => setBatches([]));
    api.get('/events').then((r) => setEvents(r.data.events)).catch(() => setEvents([]));
    api.get('/announcements').then((r) => setAnnouncements(r.data.announcements.slice(0, 3))).catch(() => {});
    api.get('/events/highlights').then((r) => setHighlights(r.data.highlights.slice(0, 6))).catch(() => {});
  }, []);

  const upcoming = (events || []).filter((e) => new Date(e.event_date) >= new Date()).slice(0, 3);
  const featured = (batches || []).slice(0, 6);

  return (
    <>
      <section className="relative bg-[var(--navy)] text-white on-dark overflow-hidden">
        {showVideo ? (
          <video className="absolute inset-0 w-full h-full object-cover" poster={heroImg} autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
            <source src={heroVideoWebm} type="video/webm" />
            <source src={heroVideoMp4} type="video/mp4" />
          </video>
        ) : (
          <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--navy)] via-[var(--navy)]/80 to-[var(--navy)]/30" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--gold)]/50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-36">
          <p className="eyebrow mb-5">The Alumni Community</p>
          <h1 className="serif text-4xl sm:text-5xl md:text-6xl leading-[1.08] max-w-3xl uppercase">
            Once a student, always a part of the family.
          </h1>
          <span className="gold-rule mt-7 !w-20" />
          <p className="mt-7 text-lg text-white/85 max-w-xl leading-relaxed">
            Reconnect with classmates, celebrate shared memories, and build a stronger alumni community across every graduating batch.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to={user ? '/dashboard' : '/register'}><Button className="!px-7 !py-3.5">Join Our Alumni Community <ArrowRight size={16} /></Button></Link>
            <Link to="/batches"><Button variant="outline" className="!px-7 !py-3.5">Explore Our Batches</Button></Link>
          </div>
        </div>
      </section>

      <section className="bg-[var(--navy-2)] on-dark" aria-label="Community statistics">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          <Stat value={stats ? stats.batches : stats === false ? '—' : '…'} label="Batches" />
          <Stat value={stats ? stats.alumni : stats === false ? '—' : '…'} label="Registered alumni" />
          <Stat value={stats ? stats.upcoming_events : stats === false ? '—' : '…'} label="Upcoming events" />
          <Stat value={stats ? stats.communities : stats === false ? '—' : '…'} label="Active communities" />
        </div>
      </section>

      <Section eyebrow="Our Alumni, Our Pride" title="A family that grows with every graduating batch">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="relative">
            <img src={communityImg} alt="Alumni gathered together" className="w-full aspect-[4/3] object-cover rounded-[var(--radius)]" loading="lazy" />
            <span className="absolute -bottom-3 -right-3 w-24 h-24 border-2 border-[var(--gold)] -z-10 hidden sm:block" />
          </div>
          <div>
            <p className="text-[var(--muted)] leading-relaxed text-lg">
              {school?.about || 'Every batch has its own story, its own memories, and its own private community. Register, choose your graduation year, and your batch president will welcome you in.'}
            </p>
            <ul className="mt-6 space-y-3 text-[var(--text)]">
              <li className="flex gap-3"><Users size={18} className="text-[var(--gold-deep)] mt-1 shrink-0" aria-hidden="true" /> A private community for every graduating batch</li>
              <li className="flex gap-3"><CalendarDays size={18} className="text-[var(--gold-deep)] mt-1 shrink-0" aria-hidden="true" /> Reunions, homecomings and networking events</li>
              <li className="flex gap-3"><Megaphone size={18} className="text-[var(--gold-deep)] mt-1 shrink-0" aria-hidden="true" /> Announcements straight from your batch president</li>
            </ul>
            <Link to="/about" className="inline-flex items-center gap-2 mt-8 font-semibold text-[var(--navy)] border-b-2 border-[var(--gold)] pb-0.5">About the association <ArrowRight size={16} /></Link>
          </div>
        </div>
      </Section>

      <Section tone="paper" eyebrow="Graduating Batches" title="Find your batch" action={<Link to="/batches" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">All batches <ArrowRight size={16} /></Link>}>
        {batches === null ? <p role="status" className="text-sm text-[var(--muted)]">Loading…</p> : featured.length === 0 ? (
          <Empty title="No batches have been created yet">The association administrator will add graduating batches soon.</Empty>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{featured.map((b) => <BatchCard key={b.id} batch={b} />)}</div>
        )}
      </Section>

      <Section eyebrow="Reunions & Events" title="Upcoming gatherings" action={<Link to="/events" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">All events <ArrowRight size={16} /></Link>}>
        {events === null ? <p role="status" className="text-sm text-[var(--muted)]">Loading…</p> : upcoming.length === 0 ? (
          <Empty title="No upcoming events">New reunions and homecomings will be announced here.</Empty>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </Section>

      {announcements.length > 0 && (
        <Section tone="paper" eyebrow="Recent Community Activity" title="Latest announcements">
          <div className="grid md:grid-cols-3 gap-6">
            {announcements.map((a) => (
              <article key={a.id} className="card p-6 border-t-2 !border-t-[var(--gold)]">
                <p className="text-xs text-[var(--muted)]">{new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <h3 className="serif text-xl text-[var(--navy)] mt-2">{a.title}</h3>
                {a.body && <p className="text-sm text-[var(--muted)] mt-2 line-clamp-3">{a.body}</p>}
              </article>
            ))}
          </div>
        </Section>
      )}

      {highlights.length > 0 && (
        <Section eyebrow="Photo Gallery" title="Moments we shared" action={<Link to="/gallery" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">Full gallery <ArrowRight size={16} /></Link>}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {highlights.map((h) => (
              <button key={h.id} onClick={() => setLightbox(h)} className="group relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-[var(--paper-2)]" aria-label={`Open ${h.event_title}`}>
                {h.media_type === 'video' ? <video src={h.media} className="w-full h-full object-cover" muted /> : <img src={h.media} alt={h.event_title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />}
              </button>
            ))}
          </div>
        </Section>
      )}

      <section className="relative bg-[var(--navy)] text-white on-dark text-center overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-[var(--gold)]/50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <p className="eyebrow mb-4">Once a Student. Always an Alumni.</p>
          <h2 className="serif text-3xl md:text-4xl">Your story is part of our story.</h2>
          <p className="mt-5 text-white/75">Join your batch community, reconnect with classmates and stay close to the school that shaped you.</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {user ? <Link to="/dashboard"><Button>Go to my dashboard</Button></Link> : (
              <>
                <Link to="/register"><Button>Join the Alumni Network</Button></Link>
                <Link to="/login"><Button variant="outline">Login</Button></Link>
              </>
            )}
          </div>
        </div>
      </section>

      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}
      <ChatWidget />
    </>
  );
}
