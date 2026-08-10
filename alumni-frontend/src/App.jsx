import { Routes, Route, Navigate, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { GraduationCap, LayoutDashboard, Calendar, Megaphone, UserCircle, IdCard, LogOut, Menu, X, MessageSquare, Shield, FileText, UsersRound, Bell, QrCode, Sparkles, Handshake, Users } from 'lucide-react';
import { useState } from 'react';
import { Wordmark, Button } from './components/ui';
import PublicHome from './pages/PublicHome';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterSuccess from './pages/RegisterSuccess';
import Signup from './pages/Signup';
import TrialExpired from './pages/TrialExpired';
import RenewRegistration from './pages/RenewRegistration';
import PlatformSignup from './pages/PlatformSignup';
import PlatformLogin from './pages/PlatformLogin';
import PlatformDashboard from './pages/PlatformDashboard';
import Dashboard from './pages/Dashboard';
import Directory from './pages/Directory';
import Events from './pages/Events';
import EventCheckin from './pages/EventCheckin';
import Announcements from './pages/Announcements';
import Jobs from './pages/Jobs';
import Profile from './pages/Profile';
import AlumniId from './pages/AlumniId';
import Messages from './pages/Messages';
import AdminUsers from './pages/AdminUsers';
import AdminPostings from './pages/AdminPostings';
import Groups from './pages/Groups';
import Notifications from './pages/Notifications';
import EventRegistrations from './pages/EventRegistrations';
import ScanRedirect from './pages/ScanRedirect';
import AdminHighlights from './pages/AdminHighlights';
import AdminPartnerships from './pages/AdminPartnerships';
import AdminOfficers from './pages/AdminOfficers';
import Officers from './pages/Officers';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/groups', label: 'Groups', icon: UsersRound },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/scan', label: 'Scan', icon: QrCode, adminOnly: true },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/my-id', label: 'My ID', icon: IdCard },
  { to: '/admin/postings', label: 'Manage Posts', icon: FileText, adminOnly: true },
  { to: '/admin/users', label: 'Users', icon: Shield, adminOnly: true },
  { to: '/admin/highlights', label: 'Highlights', icon: Sparkles, adminOnly: true },
  { to: '/admin/partnerships', label: 'Partnerships', icon: Handshake, adminOnly: true },
  { to: '/admin/officers', label: 'Officers', icon: Users, adminOnly: true },
];

function Sidebar({ open, onClose }) {
  const { user, logout, school } = useAuth();
  const nav = useNavigate();
  if (!user) return null;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:sticky lg:flex-shrink-0 top-0 left-0 h-screen w-64 bg-white border-r-[2.5px] border-[var(--brand-ink)] z-40 flex flex-col transition-transform lg:transform-none ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2 px-6 py-5 border-b-[2.5px] border-[var(--brand-ink)] flex-shrink-0">
          {school?.logo ? (
            <img src={school.logo} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] rounded-[var(--radius)] p-2">
              <GraduationCap className="text-white" size={22} />
            </div>
          )}
          <div>
            <Wordmark />
            <p className="text-xs text-slate-500 leading-tight">{school?.name || 'IHES Alumni Association'}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems
            .filter((i) => !i.adminOnly || user.role === 'admin')
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-sm font-bold transition-colors border-2 ${
                  isActive
                    ? 'bg-[var(--brand-accent)] text-white border-[var(--brand-ink)]'
                    : 'text-[var(--brand-ink)] border-transparent hover:border-[var(--brand-ink)] hover:bg-[var(--brand-surface)]'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t-[2.5px] border-[var(--brand-ink)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--brand-ink)] truncate">{user.email}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => { logout(); nav('/'); }}>
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}

function MobileHeader({ onMenu }) {
  const { user, school } = useAuth();
  if (!user) return null;
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-white border-b-[2.5px] border-[var(--brand-ink)] px-4 py-3 flex items-center gap-3">
      <button onClick={onMenu} className="p-2 border-2 border-transparent hover:border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-ink)]">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        {school?.logo ? (
          <img src={school.logo} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <GraduationCap className="text-[var(--brand-accent)]" size={20} />
        )}
        <Wordmark />
      </div>
    </header>
  );
}

function Shell({ children }) {
  const { user, trialExpired, registrationExpired } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (location.pathname.startsWith('/platform')) return <>{children}</>;

  // Public routes (no sidebar)
  const publicOnlyRoutes = ['/', '/login', '/register', '/register/success', '/signup'];
  const showSidebar = user && !publicOnlyRoutes.includes(location.pathname);

  if (user && trialExpired) return <TrialExpired />;
  if (user && registrationExpired) return <RenewRegistration />;
  if (!showSidebar) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-[var(--brand-bg)]">
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
    <Shell>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/success" element={<RegisterSuccess />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/platform/signup" element={<PlatformSignup />} />
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route path="/platform/dashboard" element={<PlatformDashboard />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/directory" element={<Protected><Directory /></Protected>} />
        <Route path="/events" element={<Protected><Events /></Protected>} />
        <Route path="/events/:id/checkin" element={<Protected><EventCheckin /></Protected>} />
        <Route path="/events/:id/registrations" element={<Protected><EventRegistrations /></Protected>} />
        <Route path="/scan" element={<Protected><ScanRedirect /></Protected>} />
        <Route path="/announcements" element={<Protected><Announcements /></Protected>} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/my-id" element={<Protected><AlumniId /></Protected>} />
        <Route path="/messages" element={<Protected><Messages /></Protected>} />
        <Route path="/groups" element={<Protected><Groups /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/admin/users" element={<Protected><AdminUsers /></Protected>} />
        <Route path="/admin/postings" element={<Protected><AdminPostings /></Protected>} />
        <Route path="/admin/highlights" element={<Protected><AdminHighlights /></Protected>} />
        <Route path="/admin/partnerships" element={<Protected><AdminPartnerships /></Protected>} />
        <Route path="/admin/officers" element={<Protected><AdminOfficers /></Protected>} />
        <Route path="/officers" element={<Officers />} />
      </Routes>
    </Shell>
  );
}
