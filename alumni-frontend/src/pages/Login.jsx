import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth';
import { Button, Input, Wordmark } from '../components/ui';

export default function Login() {
  const { login, school } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex bg-white">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--brand-ink)] relative overflow-hidden border-r-[2.5px] border-[var(--brand-ink)]">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2">
            {school?.logo ? (
              <img src={school.logo} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="bg-[var(--brand-accent)] border-2 border-white p-2 rounded-[var(--radius)]">
                <GraduationCap size={22} />
              </div>
            )}
            <Wordmark className="text-white" />
          </Link>
          <div>
            <h1 className="font-display text-5xl mb-4 leading-tight">
              Welcome<br />back.
            </h1>
            <p className="text-white/70 text-lg max-w-md">
              Sign in to access your alumni network, events, and career opportunities.
            </p>
          </div>
          <p className="text-sm text-white/50">© {new Date().getFullYear()} IHES Alumni Association</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            {school?.logo ? (
              <img src={school.logo} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
                <GraduationCap className="text-white" size={22} />
              </div>
            )}
            <Wordmark />
          </div>

          <h2 className="font-display text-3xl text-[var(--brand-ink)] mb-2">Sign in</h2>
          <p className="text-slate-500 mb-8">Enter your credentials to continue</p>

          {err && (
            <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-4 text-sm">
              {err}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  className="pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  type="password"
                  className="pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : <>Sign in <ArrowRight size={18} /></>}
            </Button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account? <Link to="/register" className="text-[var(--brand-accent)] hover:underline font-bold">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
