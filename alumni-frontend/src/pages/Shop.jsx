import { useEffect, useState } from 'react';
import { api } from '../api';
import { Section, Loading } from '../components/PageHeader';
import { Button, Input } from '../components/ui';

const peso = (c) => `₱${(c / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PHONE_RE = /^(\+?63|0)9\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors the server's computeTotals for the live preview only; the server recomputes.
function totals(price, qty, feePercent) {
  const subtotal = price * qty;
  const total = Math.ceil((subtotal * 10000) / (10000 - Math.round(feePercent * 100)));
  return { subtotal, fee: total - subtotal, total };
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold mb-1.5">{label}</label>
      {children}
      {error && <p role="alert" className="text-sm text-[var(--brand-danger)] mt-1">{error}</p>}
    </div>
  );
}

export default function Shop() {
  const [data, setData] = useState(null);
  const [productId, setProductId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', contact: '', size: '', quantity: 1, address: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { api.get('/shop').then((r) => setData(r.data)).catch(() => setData(false)); }, []);

  if (data === null) return <Section title="T-shirt shop"><Loading /></Section>;
  if (!data || !data.shop.enabled || data.products.length === 0) {
    return <Section eyebrow="Shop" title="The shop is not open right now"><p className="text-[var(--muted)]">Please check back soon.</p></Section>;
  }

  const { shop, products } = data;
  const product = products.find((p) => p.id === productId) || products[0];
  const delivery = shop.fulfillment === 'delivery';
  const qty = Math.max(1, Math.min(20, Number(form.quantity) || 1));
  const t = totals(product.price, qty, shop.fee_percent);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k] || undefined;

  const choose = (p) => { setProductId(p.id); setForm((f) => ({ ...f, size: '' })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Enter your name.';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (!PHONE_RE.test(form.contact.replace(/[\s-]/g, ''))) e.contact = 'Enter a valid mobile number, e.g. 09171234567.';
    if (!form.size) e.size = 'Choose a size.';
    if (delivery && !form.address.trim()) e.address = 'Enter your delivery address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setSending(true);
    try {
      const { data: res } = await api.post('/shop/orders', { ...form, quantity: qty, product_id: product.id });
      window.location.assign(res.checkoutUrl);
    } catch (e) {
      setFormError(e.response?.data?.error || 'Could not start your order. Please try again.');
      setSending(false);
    }
  };

  return (
    <Section eyebrow="Shop" title="Alumni T-shirts">
      <p className="mb-6 text-sm bg-[var(--paper-2)] border border-[var(--line)] p-3 rounded-[var(--radius)] max-w-2xl">
        {delivery ? 'Free delivery to your address.' : `Pickup only.${shop.pickup_info ? ` ${shop.pickup_info}` : ''}`}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10" role="radiogroup" aria-label="Choose a T-shirt">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === product.id}
            onClick={() => choose(p)}
            className={`card text-left overflow-hidden border-2 ${p.id === product.id ? '!border-[var(--gold)]' : 'border-transparent'}`}
          >
            {p.image && <img src={p.image} alt="" className="w-full aspect-square object-cover" loading="lazy" />}
            <div className="p-4">
              <h3 className="serif text-lg text-[var(--navy)]">{p.name}</h3>
              {p.description && <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">{p.description}</p>}
              <p className="mt-2 font-semibold text-[var(--navy)]">{peso(p.price)}</p>
            </div>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 max-w-xl" noValidate>
        <h2 className="serif text-2xl text-[var(--navy)]">Order: {product.name}</h2>
        {formError && <p role="alert" className="text-sm text-[var(--brand-danger)] font-semibold">{formError}</p>}
        <Field id="name" error={err('name')} label="Full name"><Input id="name" autoComplete="name" value={form.name} onChange={set('name')} maxLength={200} /></Field>
        <Field id="email" error={err('email')} label="Email"><Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} maxLength={200} /></Field>
        <Field id="contact" error={err('contact')} label="Mobile number"><Input id="contact" type="tel" inputMode="tel" autoComplete="tel" value={form.contact} onChange={set('contact')} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="size" error={err('size')} label="Size">
            <Input as="select" id="size" value={form.size} onChange={set('size')}>
              <option value="">Select</option>
              {product.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </Input>
          </Field>
          <Field id="quantity" label="Quantity"><Input id="quantity" type="number" min="1" max="20" value={form.quantity} onChange={set('quantity')} /></Field>
        </div>
        {delivery && <Field id="address" error={err('address')} label="Delivery address"><Input id="address" as="textarea" rows="3" value={form.address} onChange={set('address')} maxLength={500} /></Field>}

        <dl className="text-sm border border-[var(--line)] rounded-[var(--radius)] divide-y divide-[var(--line)]">
          <div className="flex justify-between px-4 py-2"><dt>{product.name} × {qty}</dt><dd>{peso(t.subtotal)}</dd></div>
          <div className="flex justify-between px-4 py-2"><dt>Online payment fee</dt><dd>{peso(t.fee)}</dd></div>
          <div className="flex justify-between px-4 py-3 font-bold text-[var(--navy)]"><dt>Total</dt><dd>{peso(t.total)}</dd></div>
        </dl>

        <Button type="submit" variant="navy" disabled={sending} className="w-full !py-3">{sending ? 'Please wait…' : 'Continue to payment'}</Button>
      </form>
    </Section>
  );
}
