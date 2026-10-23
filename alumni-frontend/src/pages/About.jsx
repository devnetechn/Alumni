import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import PageHeader, { Section } from '../components/PageHeader';
import { Button } from '../components/ui';
import communityImg from '../assets/community.jpg';
import presidentImg from '../assets/president.jpg';

export default function About() {
  const { school } = useAuth();
  return (
    <>
      <PageHeader eyebrow="About" title={school?.name || 'The Alumni Association'} image={communityImg}>
        A lifelong community for everyone who once walked these halls.
      </PageHeader>
      <Section>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="serif text-3xl text-[var(--navy)]">Our association</h2>
            <span className="gold-rule mt-4" />
            <p className="mt-6 text-[var(--muted)] leading-relaxed whitespace-pre-line">
              {school?.about || 'The association brings graduates of every batch together. Each graduating year has its own page, its own president and its own private community, while events, the alumni directory and the gallery are shared across the whole association.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/batches"><Button>Explore our batches</Button></Link>
              <Link to="/officers"><Button variant="secondary">Meet the officers</Button></Link>
            </div>
          </div>
          <img src={presidentImg} alt="Association leadership" className="w-full aspect-[4/5] object-cover rounded-[var(--radius)] max-w-md justify-self-center" loading="lazy" />
        </div>
      </Section>
      <Section tone="paper" eyebrow="How it works" title="From registration to your batch community">
        <ol className="grid md:grid-cols-3 gap-6">
          {[
            ['Register', 'Create your account and choose your graduation batch.'],
            ['Get approved', 'Your batch president reviews and approves your request. You are notified of the decision.'],
            ['Connect', 'Enter your private batch community to post, share photos, and join reunions.'],
          ].map(([t, d], i) => (
            <li key={t} className="card p-6">
              <p className="serif text-4xl text-[var(--gold-deep)]">0{i + 1}</p>
              <h3 className="serif text-xl text-[var(--navy)] mt-2">{t}</h3>
              <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
