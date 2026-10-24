import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api';
import { Section } from '../components/PageHeader';
import { Button } from '../components/ui';

const MAX_ATTEMPTS = 90;
const POLL_INTERVAL_MS = 2000;

export default function ShopThanks() {
  const [params] = useSearchParams();
  const token = params.get('order');
  const [paid, setPaid] = useState(false);
  const [gaveUp, setGaveUp] = useState(!token);
  const attempts = useRef(0);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      attempts.current += 1;
      try {
        const { data } = await api.get(`/shop/orders/${token}/status`);
        if (cancelled) return;
        if (data.paid) { setPaid(true); return; }
      } catch {
        // keep polling; a transient error should not end the wait
      }
      if (attempts.current >= MAX_ATTEMPTS) { if (!cancelled) setGaveUp(true); return; }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token]);

  return (
    <Section eyebrow="Shop" title={paid ? 'Thank you for your order!' : 'Confirming your payment'}>
      <div className="max-w-xl text-[var(--muted)]">
        {paid ? (
          <p className="flex gap-3 items-start"><CheckCircle2 className="text-green-600 shrink-0" aria-hidden="true" /> We received your payment. The association will contact you about your T-shirt.</p>
        ) : gaveUp ? (
          <p>We could not confirm your payment yet. If you already paid, it may still be processing. Please contact the association with your name and email.</p>
        ) : (
          <p role="status" className="flex gap-3 items-start"><Loader2 className="animate-spin text-[var(--gold-deep)] shrink-0" aria-hidden="true" /> Complete your payment in the payment page. This page updates by itself once it is confirmed.</p>
        )}
        <Link to="/" className="inline-block mt-6"><Button variant="secondary">Back to home</Button></Link>
      </div>
    </Section>
  );
}
