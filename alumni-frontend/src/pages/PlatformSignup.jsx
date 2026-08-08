import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { platformApi } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function PlatformSignup() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [alreadySetUp, setAlreadySetUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await platformApi.post('/signup', { email, password });
      localStorage.setItem('platform_token', data.token);
      nav('/platform/dashboard');
    } catch (e) {
      if (e.response?.status === 403) {
        setAlreadySetUp(true);
      } else {
        setErr(e.response?.data?.error || 'Signup failed');
      }
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

        {alreadySetUp ? (
          <>
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Already set up</h1>
            <p className="text-slate-500 mb-6 text-sm">A platform admin account already exists. This signup is closed.</p>
            <Link to="/platform/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Set up platform admin</h1>
            <p className="text-slate-500 mb-6 text-sm">One-time setup. This form closes itself after the first account.</p>

            {err && (
              <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-4 text-sm">
                {err}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-bold text-[var(--brand-ink)] mb-1.5 block">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating...' : <>Create Platform Admin <ArrowRight size={18} /></>}
              </Button>
            </form>
          </>
        )}
      </Panel>
    </div>
  );
}
