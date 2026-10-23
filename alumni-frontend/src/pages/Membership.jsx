import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, Users } from 'lucide-react';
import { useAuth } from '../auth';
import { Button } from '../components/ui';

export default function Membership() {
  const { user, membership, refresh } = useAuth();
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const state = !membership
    ? { icon: Users, tone: 'text-[var(--navy)]', title: user?.requested_batch_year ? 'Your batch is not listed yet' : 'You have not joined a batch yet', body: user?.requested_batch_year ? 'The association administrator has been notified about your graduation year. Once your batch is created you can request to join it.' : 'Choose your graduation batch to request access to its private community.', cta: <Link to="/batches"><Button>Browse batches</Button></Link> }
    : membership.status === 'pending'
      ? { icon: Clock, tone: 'text-[var(--gold-deep)]', title: 'Membership pending review', body: 'Your membership request has been submitted. The president of your selected batch will review your application. You will receive a notification when a decision is made.', cta: <Link to="/dashboard"><Button variant="secondary">Back to dashboard</Button></Link> }
      : membership.status === 'approved'
        ? { icon: CheckCircle2, tone: 'text-[var(--brand-success)]', title: `Welcome to ${membership.batch_name}`, body: 'Your request was approved. The private batch community is open to you.', cta: <Link to={`/batches/${membership.batch_id}/community`}><Button>Enter your batch community</Button></Link> }
        : { icon: XCircle, tone: 'text-[var(--brand-danger)]', title: 'Request not approved', body: membership.decision_note ? `Your request for ${membership.batch_name} was not approved: ${membership.decision_note}` : `Your request for ${membership.batch_name} was not approved by the batch president. If you believe this is a mistake, you may request a different batch or contact the association.`, cta: <Link to="/batches"><Button>Choose a batch</Button></Link> };

  const Icon = state.icon;
  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto">
      <p className="eyebrow mb-2">Membership status</p>
      <div className="card p-8 mt-2 border-t-2 !border-t-[var(--gold)]">
        <Icon size={34} className={state.tone} aria-hidden="true" />
        <h1 className="serif text-3xl text-[var(--navy)] mt-4">{state.title}</h1>
        <p className="text-[var(--muted)] mt-3 leading-relaxed">{state.body}</p>
        {membership && (
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm border-t border-[var(--line)] pt-5">
            <div><dt className="text-[var(--muted)]">Selected batch</dt><dd className="font-semibold text-[var(--navy)]">{membership.batch_name}</dd></div>
            <div><dt className="text-[var(--muted)]">Requested on</dt><dd className="font-semibold text-[var(--navy)]">{new Date(membership.requested_at).toLocaleDateString()}</dd></div>
            {membership.decided_at && <div><dt className="text-[var(--muted)]">Decision date</dt><dd className="font-semibold text-[var(--navy)]">{new Date(membership.decided_at).toLocaleDateString()}</dd></div>}
          </dl>
        )}
        <div className="mt-7">{state.cta}</div>
      </div>
    </div>
  );
}
