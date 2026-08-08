import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Wordmark } from '../components/ui';

export default function RenewRegistration() {
  const { registrationExpired, school, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const renew = async () => {
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/registration/renew-checkout');
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not start payment');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-surface)] p-6">
      <Panel className="max-w-md w-full p-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2">
          <Wordmark />
        </div>
        <div className="mx-auto mb-4 w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-danger)] border-2 border-[var(--brand-ink)] flex items-center justify-center">
          <CreditCard className="text-white" size={26} />
        </div>
        <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Registration expired</h1>
        {registrationExpired?.registrationPaidUntil && (
          <p className="text-xs text-slate-500 mb-4">
            Expired {new Date(registrationExpired.registrationPaidUntil).toLocaleDateString()}
          </p>
        )}
        <p className="text-slate-600 mb-6">Renew your registration to continue using the app.</p>
        {err && <p className="text-[var(--brand-danger)] text-sm mb-4">{err}</p>}
        <Button onClick={renew} disabled={loading} className="mx-auto">
          {loading ? 'Redirecting...' : school?.registration_fee > 0 ? `Pay ₱${(school.registration_fee / 100).toFixed(2)} to Renew` : 'Renew Registration'}
        </Button>
        <button onClick={logout} className="block mx-auto mt-6 text-sm text-slate-400 hover:text-[var(--brand-ink)] underline">
          Log out
        </button>
      </Panel>
    </div>
  );
}
