import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, XCircle } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Wordmark } from '../components/ui';

// The backend can be a cold Render free-tier instance that takes up to ~50s
// to wake from sleep, so this window needs to comfortably outlast that
// instead of the few-seconds case it was originally sized for.
const MAX_ATTEMPTS = 45;
const POLL_INTERVAL_MS = 2000;

export default function RegisterSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { setSession, refresh } = useAuth();
  const nav = useNavigate();
  const [failed, setFailed] = useState(!sessionId);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const poll = async () => {
      attemptsRef.current += 1;
      try {
        const { data } = await api.get(`/registration/signup-checkout/${sessionId}/status`);
        if (cancelled) return;
        if (data.ready) {
          setSession(data.token, data.user);
          await refresh();
          nav('/dashboard');
          return;
        }
      } catch {
        // keep polling — a transient error shouldn't fail the whole flow early
      }
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        if (!cancelled) setFailed(true);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => { cancelled = true; };
  }, [sessionId, setSession, refresh, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--brand-surface)] p-6">
      <Panel className="max-w-md w-full p-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2">
          <Wordmark />
        </div>
        {failed ? (
          <>
            <div className="mx-auto mb-4 w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-danger)] border-2 border-[var(--brand-ink)] flex items-center justify-center">
              <XCircle className="text-white" size={26} />
            </div>
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Still processing</h1>
            <p className="text-slate-600">
              Your payment may still be confirming. If this takes more than a couple of minutes, please try logging in — your account may already be ready.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 animate-spin text-[var(--brand-accent)]" size={32} />
            <h1 className="font-display text-2xl text-[var(--brand-ink)] mb-2">Confirming your payment...</h1>
            <p className="text-slate-600">This usually takes a few seconds, but can take up to a minute if the server was idle.</p>
          </>
        )}
      </Panel>
    </div>
  );
}
