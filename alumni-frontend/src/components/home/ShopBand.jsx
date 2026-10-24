import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section } from '../PageHeader';
import { Button } from '../ui';

const peso = (c) => `₱${(c / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ShopBand({ data }) {
  if (!data || !data.shop.enabled || data.products.length === 0) return null;
  return (
    <Section eyebrow="Shop" title="Wear the family colors">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.products.slice(0, 3).map((p) => (
          <Link key={p.id} to="/shop" className="card card-hover overflow-hidden block">
            {p.image && <img src={p.image} alt="" className="w-full aspect-square object-cover" loading="lazy" />}
            <div className="p-5">
              <h3 className="serif text-xl text-[var(--navy)]">{p.name}</h3>
              <p className="mt-2 font-semibold text-[var(--navy)]">{peso(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link to="/shop" className="inline-block mt-8"><Button>Order now <ArrowRight size={16} /></Button></Link>
    </Section>
  );
}
