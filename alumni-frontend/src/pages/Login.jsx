import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email, password);
      nav('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur p-2 rounded-lg">
              <GraduationCap size={22} />
            </div>
            <span className="font-bold">Alumni System</span>
          </Link>
          <div>
            <h1 className="text-5xl font-extrabold mb-4 leading-tight">
              Welcome<br />back.
            </h1>
            <p className="text-white/80 text-lg max-w-md">
              Sign in to access your alumni network, events, and career opportunities.
            </p>
          </div>
          <p className="text-sm text-white/60">© {new Date().getFullYear()} Alumni Management System</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
              <GraduationCap className="text-white" size={22} />
            </div>
            <span className="font-bold text-slate-900">Alumni System</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2">Sign in</h2>
          <p className="text-slate-500 mb-8">Enter your credentials to continue</p>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {err}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? 'Signing in...' : <>Sign in <ArrowRight size={18} /></>}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account? <Link to="/register" className="text-indigo-600 hover:underline font-semibold">Create one</Link>
          </p>

          <div className="mt-8 p-4 bg-slate-100 rounded-lg text-xs text-slate-600">
            <p className="font-semibold mb-1">Demo credentials:</p>
            <p>Admin: <code className="bg-white px-1 rounded">admin@alumni.local</code> / <code className="bg-white px-1 rounded">admin123</code></p>
            <p>Alumni: <code className="bg-white px-1 rounded">juan@alumni.com</code> / <code className="bg-white px-1 rounded">password123</code></p>
          </div>
        </form>
      </div>
    </div>
  );
}
