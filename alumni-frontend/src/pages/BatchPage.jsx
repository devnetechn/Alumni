import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock, Clock } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import BatchCover from '../components/BatchCover';
import { Section, Empty, Loading } from '../components/PageHeader';
import { Button } from '../components/ui';
import { FormAlert } from '../components/layout/AuthSplit';

export default function BatchPage() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/batches/${id}`).then((r) => setData(r.data)).catch(() => setMissing(true));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    setBusy(true); setError('');
    try {
      await api.post(`/batches/${id}/join`);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not submit your request.');
    } finally { setBusy(false); }
  };

  if (missing) return <Section><Empty title="Batch not found">This batch does not exist.</Empty></Section>;
  if (!data) return <Loading />;

  const { batch, membership, isMember, canManage } = data;
  let action;
  if (isMember) action = <Link to={`/batches/${batch.id}/community`}><Button>Enter community</Button></Link>;
  else if (!user) action = <Link to="/register"><Button>Register to join</Button></Link>;
  else if (user.role === 'admin') action = null;
  else if (!membership || membership.status === 'rejected') action = <Button onClick={join} disabled={busy}>{busy ? 'Submitting…' : 'Request to join this batch'}</Button>;
  else action = <span className="inline-flex items-center gap-2 bg-white/10 border border-white/25 px-4 py-2.5 text-sm"><Clock size={15} aria-hidden="true" /> Request pending review</span>;

  return (
    <>
      <BatchCover batch={batch}>{action}</BatchCover>
      <Section>
        <FormAlert>{error}</FormAlert>
        <div className="grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            <h2 className="serif text-2xl text-[var(--navy)]">About {batch.name}</h2>
            <span className="gold-rule mt-3" />
            <p className="mt-5 text-[var(--muted)] leading-relaxed whitespace-pre-line">{batch.description || 'This batch has not added a description yet.'}</p>
          </div>
          <aside className="card p-6 h-fit border-t-2 !border-t-[var(--gold)]">
            <Lock size={20} className="text-[var(--gold-deep)]" aria-hidden="true" />
            <h3 className="serif text-lg text-[var(--navy)] mt-3">Private community</h3>
            {isMember ? (
              <p className="text-sm text-[var(--muted)] mt-2">You have access to announcements, posts, photos and events of this batch{canManage ? ' as its manager' : ''}.</p>
            ) : (
              <p className="text-sm text-[var(--muted)] mt-2">Posts, photos, member lists and batch events are visible only to approved members of {batch.name}. Membership is approved by the batch president.</p>
            )}
            {membership?.status === 'rejected' && <p className="text-sm text-[var(--brand-danger)] mt-3">Your previous request was not approved. You may submit a new request.</p>}
          </aside>
        </div>
      </Section>
    </>
  );
}
