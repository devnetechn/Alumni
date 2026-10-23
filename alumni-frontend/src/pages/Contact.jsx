import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { useAuth } from '../auth';
import PageHeader, { Section, Empty } from '../components/PageHeader';
import heroImg from '../assets/hero.png';

export default function Contact() {
  const { school } = useAuth();
  const items = school ? [
    school.contact_email && [Mail, 'Email', <a key="m" href={`mailto:${school.contact_email}`} className="underline break-all">{school.contact_email}</a>],
    school.contact_phone && [Phone, 'Phone', school.contact_phone],
    school.contact_address && [MapPin, 'Address', school.contact_address],
    school.facebook_url && [Globe, 'Facebook', <a key="f" href={school.facebook_url} target="_blank" rel="noreferrer" className="underline break-all">{school.facebook_url}</a>],
  ].filter(Boolean) : [];

  return (
    <>
      <PageHeader eyebrow="Contact" title="Get in touch" image={heroImg}>
        Questions about membership, your batch or upcoming events.
      </PageHeader>
      <Section>
        {items.length === 0 ? (
          <Empty title="Contact details have not been published yet">The association administrator can add them from the admin dashboard.</Empty>
        ) : (
          <dl className="grid sm:grid-cols-2 gap-6 max-w-3xl">
            {items.map(([Icon, label, value]) => (
              <div key={label} className="card p-6 border-t-2 !border-t-[var(--gold)]">
                <Icon size={22} className="text-[var(--gold-deep)]" aria-hidden="true" />
                <dt className="eyebrow mt-4">{label}</dt>
                <dd className="mt-1 text-[var(--navy)] font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>
    </>
  );
}
