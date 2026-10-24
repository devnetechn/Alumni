import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Mail, Phone, MapPin, Globe, LogOut } from 'lucide-react';
import { useAuth } from '../../auth';
import { Wordmark, Button } from '../ui';
import NotificationBell from '../NotificationBell';

const BRAND_NAME = 'IHES Alumni Association';

const LINKS = [
  ['Home', '/', true],
  ['About', '/about'],
  ['Batches', '/batches'],
  ['Events', '/events'],
  ['Alumni Directory', '/directory'],
  ['Gallery', '/gallery'],
  ['Contact', '/contact'],
];

const linkClass = ({ isActive }) =>
  `px-1 py-2 text-[13px] font-medium tracking-wide border-b-2 transition-colors ${
    isActive ? 'text-[var(--gold)] border-[var(--gold)]' : 'text-white/85 border-transparent hover:text-white'
  }`;

export function Navbar() {
  const { user, school, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-[var(--navy)] border-b border-[var(--gold)]/30 on-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[68px] flex items-center gap-4">
        <Link to="/" className="shrink-0 min-w-0" aria-label="Home">
          <Wordmark school={{ ...school, name: BRAND_NAME }} size={38} className="[&>span]:max-w-[190px]" />
        </Link>

        <nav aria-label="Primary" className="hidden xl:flex items-center gap-6 ml-auto">
          {LINKS.map(([label, to, end]) => <NavLink key={to} to={to} end={end} className={linkClass}>{label}</NavLink>)}
        </nav>

        <div className="flex items-center gap-2 ml-auto xl:ml-2">
          {user ? (
            <>
              <NotificationBell className="text-white" />
              <Link to="/dashboard" className="hidden sm:block"><Button variant="primary" className="!py-2">Dashboard</Button></Link>
              <button onClick={() => { logout(); nav('/'); }} className="hidden xl:inline-flex p-2 text-white/80 hover:text-white" aria-label="Log out"><LogOut size={18} /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex text-[13px] font-medium text-white/90 hover:text-[var(--gold)] px-3 py-2">Login</Link>
              <Link to="/register" className="hidden sm:block"><Button variant="primary" className="!py-2">Register</Button></Link>
            </>
          )}
          <button onClick={() => setOpen((v) => !v)} className="xl:hidden p-2 text-white" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="xl:hidden bg-[var(--navy-2)] border-t border-white/10 px-4 py-3 flex flex-col">
          {LINKS.map(([label, to, end]) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `py-3 text-sm font-medium border-b border-white/10 ${isActive ? 'text-[var(--gold)]' : 'text-white'}`}>{label}</NavLink>
          ))}
          <div className="flex gap-3 pt-4">
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="flex-1"><Button className="w-full">Dashboard</Button></Link>
                <Button variant="outline" onClick={() => { logout(); setOpen(false); nav('/'); }}>Log out</Button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="flex-1"><Button variant="outline" className="w-full">Login</Button></Link>
                <Link to="/register" onClick={() => setOpen(false)} className="flex-1"><Button className="w-full">Register</Button></Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { school } = useAuth();
  const hasContact = school && (school.contact_email || school.contact_phone || school.contact_address);
  return (
    <footer className="bg-[var(--navy)] text-white/80 on-dark">
      <div className="h-px bg-[var(--gold)]/40" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <Wordmark school={{ ...school, name: BRAND_NAME }} size={46} />
          <p className="mt-4 text-sm leading-relaxed text-white/65 max-w-xs">Once a student, always a part of the family.</p>
        </div>
        <div>
          <h2 className="eyebrow mb-4">Explore</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {LINKS.map(([label, to]) => <li key={to}><Link to={to} className="hover:text-[var(--gold)]">{label}</Link></li>)}
            <li><Link to="/officers" className="hover:text-[var(--gold)]">Officers</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="eyebrow mb-4">Contact</h2>
          {hasContact ? (
            <ul className="space-y-3 text-sm">
              {school.contact_email && <li className="flex gap-2.5"><Mail size={16} className="mt-0.5 text-[var(--gold)] shrink-0" aria-hidden="true" /><a href={`mailto:${school.contact_email}`} className="hover:text-[var(--gold)] break-all">{school.contact_email}</a></li>}
              {school.contact_phone && <li className="flex gap-2.5"><Phone size={16} className="mt-0.5 text-[var(--gold)] shrink-0" aria-hidden="true" />{school.contact_phone}</li>}
              {school.contact_address && <li className="flex gap-2.5"><MapPin size={16} className="mt-0.5 text-[var(--gold)] shrink-0" aria-hidden="true" />{school.contact_address}</li>}
            </ul>
          ) : (
            <p className="text-sm text-white/55">Contact details have not been published yet.</p>
          )}
          {school?.facebook_url && (
            <a href={school.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook" className="inline-flex mt-5 p-2 border border-white/25 rounded-full hover:border-[var(--gold)] hover:text-[var(--gold)]"><Globe size={16} /></a>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {school?.name || 'Alumni Association'}. All rights reserved.
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--gold)] focus:text-[var(--navy)] focus:px-4 focus:py-2">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
