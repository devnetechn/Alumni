import { Routes, Route, Navigate, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { GraduationCap, LayoutDashboard, Users, Calendar, Megaphone, Briefcase, UserCircle, IdCard, LogOut, Menu, X, MessageSquare, Shield, FileText, UsersRound, Bell, QrCode } from 'lucide-react';
import { useState } from 'react';
import PublicHome from './pages/PublicHome';
import Login from './pages/Login';
import Register from './pages/Register';
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

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/directory', label: 'Directory', icon: Users },
  { to: '/groups', label: 'Groups', icon: UsersRound },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/scan', label: 'Scan', icon: QrCode, adminOnly: true },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/my-id', label: 'My ID', icon: IdCard },
  { to: '/admin/postings', label: 'Manage Posts', icon: FileText, adminOnly: true },
  { to: '/admin/users', label: 'Users', icon: Shield, adminOnly: true },
];

function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:sticky lg:flex-shrink-0 top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-40 flex flex-col transition-transform lg:transform-none ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
            <GraduationCap className="text-white" size={22} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">IHES</h1>
            <p className="text-xs text-slate-500 leading-tight">Alumni Association</p>
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
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); nav('/'); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

function MobileHeader({ onMenu }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
      <button onClick={onMenu} className="p-2 hover:bg-slate-100 rounded-lg">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        <GraduationCap className="text-indigo-600" size={20} />
        <span className="font-bold">IHES Alumni Association</span>
      </div>
    </header>
  );
}

function Shell({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Public routes (no sidebar)
  const publicOnlyRoutes = ['/', '/login', '/register'];
  const showSidebar = user && !publicOnlyRoutes.includes(location.pathname);

  if (!showSidebar) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-slate-50">
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
      </Routes>
    </Shell>
  );
}
