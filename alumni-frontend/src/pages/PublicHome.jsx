import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/ui';
import Overview, { StatsStrip } from '../components/home/Overview';
import AnnouncementsSection from '../components/home/AnnouncementsSection';
import RecapGallery from '../components/home/RecapGallery';
import ProjectsSection from '../components/home/ProjectsSection';
import AlumniFaces from '../components/home/AlumniFaces';
import SponsorBand from '../components/home/SponsorBand';
import Partnerships from '../components/home/Partnerships';
import Lightbox from '../components/Lightbox';
import ChatWidget from '../components/ChatWidget';
import heroImg from '../assets/hero.png';
import heroVideoMp4 from '../assets/hero.mp4';
import heroVideoWebm from '../assets/hero.webm';

// Skip the video for users who prefer reduced motion or have data saver on.
const showVideo =
  typeof window !== 'undefined' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !navigator.connection?.saveData;

export default function PublicHome() {
  const { user, school } = useAuth();
  const [stats, setStats] = useState(null);
  const [batches, setBatches] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [recap, setRecap] = useState(null);
  const [projects, setProjects] = useState([]);
  const [faces, setFaces] = useState([]);
  const [partners, setPartners] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api.get('/public-stats').then((r) => setStats(r.data)).catch(() => setStats(false));
    api.get('/batches').then((r) => setBatches(r.data.batches)).catch(() => {});
    api.get('/announcements').then((r) => setAnnouncements(r.data.announcements.slice(0, 3))).catch(() => {});
    api.get('/events/recap').then((r) => setRecap(r.data)).catch(() => {});
    api.get('/projects').then((r) => setProjects([...r.data.projects].sort((a, b) => Number(b.featured) - Number(a.featured)))).catch(() => {});
    api.get('/alumni-stories').then((r) => setFaces([...r.data.stories].sort((a, b) => Number(b.featured) - Number(a.featured)))).catch(() => {});
    api.get('/partners').then((r) => setPartners(r.data.partners)).catch(() => {});
  }, []);

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

      <StatsStrip stats={stats} />
      <Overview school={school} />
      <AlumniFaces items={faces} />
      <ProjectsSection items={projects} />
      <AnnouncementsSection items={announcements} />
      <RecapGallery recap={recap} batches={batches} onOpen={setLightbox} />
      <SponsorBand />
      <Partnerships items={partners} />

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
