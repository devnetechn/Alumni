import { useEffect, useState } from 'react';
import { api } from '../api';
import PageHeader, { Section, Empty, Loading } from '../components/PageHeader';
import BatchCard from '../components/BatchCard';
import { Input } from '../components/ui';
import communityImg from '../assets/community.jpg';

export default function Batches() {
  const [batches, setBatches] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/batches').then((r) => setBatches(r.data.batches)).catch(() => setBatches([])); }, []);

  const shown = (batches || []).filter((b) => !q || String(b.year).includes(q) || b.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader eyebrow="Graduating batches" title="Every batch has a family" image={communityImg}>
        Choose your graduation year to see your batch, its president and its community.
      </PageHeader>
      <Section>
        <div className="max-w-sm mb-8">
          <label htmlFor="batch-search" className="sr-only">Search batches by year</label>
          <Input id="batch-search" placeholder="Search by year, e.g. 2018" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {batches === null ? <Loading /> : shown.length === 0 ? (
          <Empty title={batches.length === 0 ? 'No batches yet' : 'No batch matches your search'}>
            {batches.length === 0 ? 'The association administrator has not created any batches yet.' : 'Try a different year.'}
          </Empty>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{shown.map((b) => <BatchCard key={b.id} batch={b} />)}</div>
        )}
      </Section>
    </>
  );
}
