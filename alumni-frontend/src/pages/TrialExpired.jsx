import { Clock, Mail } from 'lucide-react';
import { useAuth } from '../auth';
import { Panel, Wordmark } from '../components/ui';

export default function TrialExpired() {
  const { user, trialExpired, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-surface)] p-6">
      <Panel className="max-w-md w-full p-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2">
          <Wordmark />
        </div>
        <div className="mx-auto mb-4 w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-danger)] border-2 border-[var(--brand-ink)] flex items-center justify-center">
          <Clock className="text-white" size={26} />
        </div>
        <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Trial expired</h1>
        {trialExpired?.trialEndsAt && (
          <p className="text-xs text-slate-500 mb-4">
            Trial ended {new Date(trialExpired.trialEndsAt).toLocaleDateString()}
          </p>
        )}
        {isAdmin ? (
          <>
            <p className="text-slate-600 mb-6">Your school's trial has ended. Contact us to continue using the platform.</p>
            <a
              href="mailto:hello@yourapp.com?subject=Continue%20my%20school's%20subscription"
              className="inline-flex items-center gap-2 border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-xs uppercase tracking-wide px-4 py-2.5 bg-[var(--brand-accent)] text-white shadow-[3px_3px_0_var(--brand-ink)]"
            >
              <Mail size={16} /> Contact us
            </a>
          </>
        ) : (
          <p className="text-slate-600 mb-6">This school's trial has ended. An admin needs to renew access before you can continue.</p>
        )}
        <button onClick={logout} className="block mx-auto mt-6 text-sm text-slate-400 hover:text-[var(--brand-ink)] underline">
          Log out
        </button>
      </Panel>
    </div>
  );
}
