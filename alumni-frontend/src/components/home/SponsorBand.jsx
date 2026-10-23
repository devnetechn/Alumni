import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';

export default function SponsorBand() {
  return (
    <section className="bg-[var(--paper-2)]" aria-labelledby="sponsor-heading">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="eyebrow mb-3">Sponsorship</p>
        <h2 id="sponsor-heading" className="serif text-3xl text-[var(--navy)]">Help us keep the family together</h2>
        <p className="mt-4 text-[var(--muted)] max-w-2xl mx-auto">Your sponsorship supports reunions, scholarships and projects that bring every batch closer.</p>
        <Link to="/sponsor" className="inline-block mt-7"><Button>Become a sponsor <ArrowRight size={16} /></Button></Link>
      </div>
    </section>
  );
}
