import { Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Megaphone, UserCircle, IdCard, LogOut, Menu, MessageSquare, Shield, FileText, Bell, QrCode, Sparkles, Handshake, Users, Layers, ShieldCheck, Home, BadgeCheck, UsersRound, BookOpen, Images, Hammer, GraduationCap, HeartHandshake, ShoppingBag } from 'lucide-react';
import { useState, lazy, Suspense } from 'react';
import { useAuth } from './auth';
import { Wordmark, Button } from './components/ui';
import PublicLayout from './components/layout/PublicLayout';
import NotificationBell from './components/NotificationBell';
import PublicHome from './pages/PublicHome';
const About = lazy(() => import('./pages/About'));
const Batches = lazy(() => import('./pages/Batches'));
const BatchPage = lazy(() => import('./pages/BatchPage'));
const BatchCommunity = lazy(() => import('./pages/BatchCommunity'));
const Membership = lazy(() => import('./pages/Membership'));
const President = lazy(() => import('./pages/President'));
const AdminBatches = lazy(() => import('./pages/AdminBatches'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const RegisterSuccess = lazy(() => import('./pages/RegisterSuccess'));
const Signup = lazy(() => import('./pages/Signup'));
const TrialExpired = lazy(() => import('./pages/TrialExpired'));
const RenewRegistration = lazy(() => import('./pages/RenewRegistration'));
const PlatformSignup = lazy(() => import('./pages/PlatformSignup'));
const PlatformLogin = lazy(() => import('./pages/PlatformLogin'));
const PlatformDashboard = lazy(() => import('./pages/PlatformDashboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Directory = lazy(() => import('./pages/Directory'));
const DirectoryProfile = lazy(() => import('./pages/Directory').then((m) => ({ default: m.DirectoryProfile })));
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const EventCheckin = lazy(() => import('./pages/EventCheckin'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Profile = lazy(() => import('./pages/Profile'));
const AlumniId = lazy(() => import('./pages/AlumniId'));
const Messages = lazy(() => import('./pages/Messages'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminPostings = lazy(() => import('./pages/AdminPostings'));
const Groups = lazy(() => import('./pages/Groups'));
const Notifications = lazy(() => import('./pages/Notifications'));
const EventRegistrations = lazy(() => import('./pages/EventRegistrations'));
const ScanRedirect = lazy(() => import('./pages/ScanRedirect'));
const AdminHighlights = lazy(() => import('./pages/AdminHighlights'));
const AdminPartnerships = lazy(() => import('./pages/AdminPartnerships'));
const AdminOverview = lazy(() => import('./pages/AdminOverview'));
const Sponsor = lazy(() => import('./pages/Sponsor'));
const Shop = lazy(() => import('./pages/Shop'));
const ShopThanks = lazy(() => import('./pages/ShopThanks'));
const AdminShop = lazy(() => import('./pages/AdminShop'));
const AdminSponsorInquiries = lazy(() => import('./pages/AdminSponsorInquiries'));
const AdminProjects = lazy(() => import('./pages/AdminProjects'));
const AdminAlumniStories = lazy(() => import('./pages/AdminAlumniStories'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const AlumniStoryDetail = lazy(() => import('./pages/AlumniStoryDetail'));
const AdminBatchGallery = lazy(() => import('./pages/AdminBatchGallery'));
const AnnouncementDetail = lazy(() => import('./pages/AnnouncementDetail'));
const AdminOfficers = lazy(() => import('./pages/AdminOfficers'));
const Officers = lazy(() => import('./pages/Officers'));

function Protected({ children, admin, president }) {
  const { user, loading, managedBatches, meReady } = useAuth();
  if (loading || (user && !meReady)) return <div className="p-8 text-[var(--muted)]" role="status">Loading…</div>;
  if (!user) return <Navigate to="/login" />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" />;
  if (president && user.role !== 'admin' && managedBatches.length === 0) return <Navigate to="/dashboard" />;
  return children;
}

function navFor(user, managedBatches, membership) {
  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/membership', label: 'Membership', icon: BadgeCheck, hide: user.role === 'admin' },
    membership?.status === 'approved' && { to: `/batches/${membership.batch_id}/community`, label: 'My batch', icon: UsersRound },
    (managedBatches.length > 0 || user.role === 'admin') && { to: '/president', label: 'Batch management', icon: ShieldCheck },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/profile', label: 'Profile', icon: UserCircle },
    { to: '/my-id', label: 'My ID', icon: IdCard },
    { to: '/scan', label: 'Scan', icon: QrCode, admin: true },
    { to: '/admin/batches', label: 'Batches & oversight', icon: Layers, admin: true },
    { to: '/admin/users', label: 'Users & roles', icon: Shield, admin: true },
    { to: '/admin/postings', label: 'Posts', icon: FileText, admin: true },
    { to: '/admin/highlights', label: 'Gallery photos', icon: Sparkles, admin: true },
    { to: '/admin/overview', label: 'Homepage overview', icon: BookOpen, admin: true },
    { to: '/admin/batch-gallery', label: 'Batch gallery', icon: Images, admin: true },
    { to: '/admin/projects', label: 'Projects', icon: Hammer, admin: true },
    { to: '/admin/alumni-stories', label: 'Alumni stories', icon: GraduationCap, admin: true },
    { to: '/admin/sponsor-inquiries', label: 'Sponsor inquiries', icon: HeartHandshake, admin: true },
    { to: '/admin/shop', label: 'T-shirt shop', icon: ShoppingBag, admin: true },
    { to: '/admin/partnerships', label: 'Partnerships', icon: Handshake, admin: true },
    { to: '/admin/officers', label: 'Officers', icon: Users, admin: true },
  ];
  return items.filter((i) => i && !i.hide && (!i.admin || user.role === 'admin'));
}

function Sidebar({ open, onClose }) {
  const { user, logout, school, managedBatches, membership } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const items = navFor(user, managedBatches, membership);

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside aria-label="Dashboard navigation" className={`fixed lg:sticky lg:flex-shrink-0 top-0 left-0 h-screen w-64 bg-[var(--navy)] text-white z-40 flex flex-col transition-transform lg:transform-none on-dark ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-[var(--gold)]/30 flex-shrink-0">
          <Link to="/" onClick={onClose} aria-label="Public website"><Wordmark school={school} size={38} className="[&>span]:text-[15px]" /></Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <NavLink to="/" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/70 hover:text-white"><Home size={17} aria-hidden="true" /> Public website</NavLink>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onClose}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-[var(--radius)] border-l-2 transition-colors ${isActive ? 'bg-white/10 text-[var(--gold)] border-[var(--gold)]' : 'text-white/80 border-transparent hover:bg-white/5 hover:text-white'}`}>
              <item.icon size={17} aria-hidden="true" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-shrink-0 border-t border-white/10 p-4">
          <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
          <p className="text-xs text-white/60 capitalize mb-3">{user.role === 'admin' ? 'Super admin' : managedBatches.length ? 'Batch president' : 'Alumni member'}</p>
          <Button variant="outline" className="w-full !py-2" onClick={() => { logout(); nav('/'); }}><LogOut size={15} aria-hidden="true" /> Log out</Button>
        </div>
      </aside>
    </>
  );
}

function MobileHeader({ onMenu }) {
  const { school } = useAuth();
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-[var(--navy)] text-white px-4 py-3 flex items-center justify-between border-b border-[var(--gold)]/30 on-dark">
      <button onClick={onMenu} className="p-2 -ml-2" aria-label="Open menu"><Menu size={22} /></button>
      <Wordmark school={school} size={30} className="[&>span]:text-[15px] [&>span]:max-w-[180px] [&>span]:truncate" />
      <NotificationBell />
    </header>
  );
}

const DASHBOARD_PREFIXES = ['/dashboard', '/membership', '/president', '/notifications', '/messages', '/profile', '/my-id', '/scan', '/admin', '/groups', '/jobs'];
const BARE = ['/login', '/register', '/register/success', '/signup'];

function PageFallback() {
  return <div className="min-h-[60vh] flex items-center justify-center text-sm text-[var(--muted)]" role="status">Loading…</div>;
}

function Shell({ children }) {
  const { user, trialExpired, registrationExpired } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  if (pathname.startsWith('/platform') || BARE.includes(pathname)) return <>{children}</>;
  if (user && trialExpired) return <TrialExpired />;
  if (user && registrationExpired) return <RenewRegistration />;

  const dashboard = user && (DASHBOARD_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || /^\/events\/\d+\/(checkin|registrations)$/.test(pathname));
  if (!dashboard) return <PublicLayout>{children}</PublicLayout>;

  return (
    <div className="flex min-h-screen bg-[var(--paper-2)]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader onMenu={() => setOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Shell>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/about" element={<About />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/batches/:id" element={<BatchPage />} />
        <Route path="/batches/:id/community" element={<Protected><BatchCommunity /></Protected>} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/directory/:id" element={<DirectoryProfile />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/officers" element={<Officers />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/success" element={<RegisterSuccess />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/platform/signup" element={<PlatformSignup />} />
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route path="/platform/dashboard" element={<PlatformDashboard />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/membership" element={<Protected><Membership /></Protected>} />
        <Route path="/president" element={<Protected president><President /></Protected>} />
        <Route path="/events/:id/checkin" element={<Protected><EventCheckin /></Protected>} />
        <Route path="/events/:id/registrations" element={<Protected admin><EventRegistrations /></Protected>} />
        <Route path="/scan" element={<Protected admin><ScanRedirect /></Protected>} />
        <Route path="/sponsor" element={<Sponsor />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/thanks" element={<ShopThanks />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/alumni-stories/:id" element={<AlumniStoryDetail />} />
        <Route path="/announcements/:id" element={<AnnouncementDetail />} />
        <Route path="/announcements" element={<Protected><Announcements /></Protected>} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/my-id" element={<Protected><AlumniId /></Protected>} />
        <Route path="/messages" element={<Protected><Messages /></Protected>} />
        <Route path="/groups" element={<Protected><Groups /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/admin/batches" element={<Protected admin><AdminBatches /></Protected>} />
        <Route path="/admin/users" element={<Protected admin><AdminUsers /></Protected>} />
        <Route path="/admin/postings" element={<Protected admin><AdminPostings /></Protected>} />
        <Route path="/admin/highlights" element={<Protected admin><AdminHighlights /></Protected>} />
        <Route path="/admin/overview" element={<Protected admin><AdminOverview /></Protected>} />
        <Route path="/admin/shop" element={<Protected admin><AdminShop /></Protected>} />
        <Route path="/admin/batch-gallery" element={<Protected admin><AdminBatchGallery /></Protected>} />
        <Route path="/admin/projects" element={<Protected admin><AdminProjects /></Protected>} />
        <Route path="/admin/alumni-stories" element={<Protected admin><AdminAlumniStories /></Protected>} />
        <Route path="/admin/sponsor-inquiries" element={<Protected admin><AdminSponsorInquiries /></Protected>} />
        <Route path="/admin/partnerships" element={<Protected admin><AdminPartnerships /></Protected>} />
        <Route path="/admin/officers" element={<Protected admin><AdminOfficers /></Protected>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </Suspense>
    </Shell>
    </Suspense>
  );
}
