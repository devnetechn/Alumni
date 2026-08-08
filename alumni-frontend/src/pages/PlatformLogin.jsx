import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowRight } from 'lucide-react';
import { platformApi } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function PlatformLogin() {
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
      const { data } = await platformApi.post('/login', { email, password });
      localStorage.setItem('platform_token', data.token);
      nav('/platform/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-ink)] p-6">
      <Panel className="max-w-md w-full p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
            <Shield className="text-white" size={22} />
          </div>
          <div>
            <Wordmark />
            <p className="text-xs text-slate-500 leading-tight">Platform Admin</p>
          </div>
        </div>

        <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Sign in</h1>
        <p className="text-slate-500 mb-6 text-sm">Platform operator access only.</p>

        {err && (
          <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-4 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input type="password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : <>Sign in <ArrowRight size={18} /></>}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/" className="text-[var(--brand-accent)] hover:underline font-bold">Back to home</Link>
        </p>
      </Panel>
    </div>
  );
}
