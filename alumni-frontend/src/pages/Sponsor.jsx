import { useState } from 'react';
import { HeartHandshake, GraduationCap, CalendarDays, Megaphone, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { Section } from '../components/PageHeader';
import { Button, Input } from '../components/ui';

const PAYMENT_LINK = 'https://pm.link/org-ddPpa4b9PrsizcSpoq1NPGxr/c9RUq24';

const BENEFITS = [
  { icon: GraduationCap, title: 'Support our alumni', text: 'Help fund scholarships, projects and programs that keep the community growing.' },
  { icon: CalendarDays, title: 'Be part of our events', text: 'Reunions and homecomings bring hundreds of alumni together. Be seen there.' },
  { icon: Megaphone, title: 'Get recognized', text: 'Sponsors are featured on the alumni homepage and at our gatherings.' },
];

export default function Sponsor() {
  const [form, setForm] = useState({ name: '', email: '', organization: '', message: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await api.post('/sponsor/inquiries', form);
      setStatus('sent');
      setForm({ name: '', email: '', organization: '', message: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send your inquiry. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <>
      <Section eyebrow="Sponsorship" title="Become a sponsor of our alumni community">
        <div className="grid md:grid-cols-3 gap-6 mb-14">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card p-6 border-t-2 !border-t-[var(--gold)]">
              <b.icon className="text-[var(--gold-deep)]" size={24} aria-hidden="true" />
              <h3 className="serif text-xl text-[var(--navy)] mt-3">{b.title}</h3>
              <p className="text-sm text-[var(--muted)] mt-2">{b.text}</p>
            </div>
          ))}
        </div>

        <div className="card p-6 mb-14 border-l-2 !border-l-[var(--gold)] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="serif text-2xl text-[var(--navy)]">Ready to give now?</h2>
            <p className="text-sm text-[var(--muted)] mt-1">Send your sponsorship or donation through our secure PayMongo payment page.</p>
          </div>
          <a href={PAYMENT_LINK} target="_blank" rel="noopener noreferrer"><Button>Pay online <ExternalLink size={16} /></Button></a>
        </div>

        <div className="max-w-xl">
          <h2 className="serif text-2xl text-[var(--navy)] flex items-center gap-2"><HeartHandshake className="text-[var(--gold-deep)]" aria-hidden="true" /> Tell us how you'd like to help</h2>
          {status === 'sent' ? (
            <p role="status" className="mt-6 text-green-700 font-semibold">Thank you! We received your inquiry and will get in touch soon.</p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {error && <p role="alert" className="text-sm text-[var(--brand-danger)] font-semibold">{error}</p>}
              <div>
                <label htmlFor="sp-name" className="block text-sm font-bold mb-1.5">Your name</label>
                <Input id="sp-name" value={form.name} onChange={set('name')} required maxLength={200} />
              </div>
              <div>
                <label htmlFor="sp-email" className="block text-sm font-bold mb-1.5">Email</label>
                <Input id="sp-email" type="email" value={form.email} onChange={set('email')} required maxLength={200} />
              </div>
              <div>
                <label htmlFor="sp-org" className="block text-sm font-bold mb-1.5">Organization (optional)</label>
                <Input id="sp-org" value={form.organization} onChange={set('organization')} maxLength={200} />
              </div>
              <div>
                <label htmlFor="sp-msg" className="block text-sm font-bold mb-1.5">Message (optional)</label>
                <Input id="sp-msg" as="textarea" rows="5" value={form.message} onChange={set('message')} maxLength={5000} />
              </div>
              <Button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send inquiry'}</Button>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}
