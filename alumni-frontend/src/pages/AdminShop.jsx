import { useEffect, useRef, useState } from 'react';
import { ShoppingBag, Upload, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from '../components/ui';
import { validateFile, resizeImage } from '../lib/media';

const peso = (c) => `₱${(c / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = 'block text-sm font-bold text-[var(--brand-ink)] mb-1.5';

export default function AdminShop() {
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | product

  const loadProducts = () => api.get('/shop/products').then((r) => setProducts(r.data.products)).catch(() => {});
  const loadOrders = () => api.get('/shop/orders').then((r) => setOrders(r.data.orders)).catch(() => {});
  useEffect(() => {
    api.get('/shop').then((r) => setShop(r.data.shop));
    loadProducts();
    loadOrders();
  }, []);

  const toggleActive = async (p) => { await api.patch(`/shop/products/${p.id}`, { active: !p.active }); loadProducts(); };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? Past orders keep their details.`)) return;
    await api.delete(`/shop/products/${p.id}`);
    loadProducts();
  };
  const toggleFulfilled = async (o) => { await api.patch(`/shop/orders/${o.id}`, { fulfilled: !o.fulfilled }); loadOrders(); };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2"><ShoppingBag className="text-[var(--gold-deep)]" /> T-shirt shop</h1>
        <p className="text-slate-500 mt-1">Add your T-shirts, set pickup or delivery, then track orders. Customers pay online without an account.</p>
      </div>

      <Panel className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-display text-xl text-[var(--brand-ink)]">T-shirts</h2>
          <Button type="button" onClick={() => setEditing('new')}><Plus size={16} /> Add T-shirt</Button>
        </div>
        {editing && (
          <ProductForm
            key={editing === 'new' ? 'new' : editing.id}
            product={editing === 'new' ? null : editing}
            onDone={() => { setEditing(null); loadProducts(); }}
            onCancel={() => setEditing(null)}
          />
        )}
        <ul className="mt-5 divide-y divide-[var(--line)]">
          {products.length === 0 && <li className="py-4 text-slate-500">No T-shirts yet. Click "Add T-shirt".</li>}
          {products.map((p) => (
            <li key={p.id} className="py-3 flex items-center gap-4">
              {p.image ? <img src={p.image} alt="" className="w-16 h-16 rounded-[var(--radius)] object-cover shrink-0" /> : <div className="w-16 h-16 rounded-[var(--radius)] bg-[var(--brand-surface)] shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{p.name} {!p.active && <span className="text-xs text-slate-500 font-normal">(hidden)</span>}</p>
                <p className="text-sm text-slate-500">{peso(p.price)} · {p.sizes.join(', ')}</p>
              </div>
              <button type="button" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} className="p-2 text-slate-600 hover:text-[var(--navy)]"><Pencil size={18} /></button>
              <button type="button" onClick={() => toggleActive(p)} aria-label={p.active ? `Hide ${p.name}` : `Show ${p.name}`} className="p-2 text-slate-600 hover:text-[var(--navy)]">{p.active ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <button type="button" onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="p-2 text-slate-600 hover:text-[var(--brand-danger)]"><Trash2 size={18} /></button>
            </li>
          ))}
        </ul>
      </Panel>

      {shop && <SettingsForm shop={shop} onSaved={setShop} />}

      <Panel className="overflow-hidden">
        <h2 className="font-display text-xl text-[var(--brand-ink)] px-6 pt-5">Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-[var(--line)]">
                <th className="px-6 py-2">Customer</th><th className="px-3 py-2">Order</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2">Claimed / delivered</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan="5" className="px-6 py-6 text-slate-500">No orders yet.</td></tr>}
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[var(--line)] align-top">
                  <td className="px-6 py-3">
                    <p className="font-semibold">{o.name}</p>
                    <p className="text-xs text-slate-500">{o.email} · {o.contact}</p>
                    {o.address && <p className="text-xs text-slate-500 mt-1">{o.address}</p>}
                  </td>
                  <td className="px-3 py-3">{o.product_name}<br /><span className="text-xs text-slate-500">{o.size} × {o.quantity}</span></td>
                  <td className="px-3 py-3">{peso(o.total)}</td>
                  <td className="px-3 py-3"><span className={o.paid ? 'text-green-700 font-semibold' : 'text-slate-500'}>{o.paid ? 'Paid' : 'Unpaid'}</span></td>
                  <td className="px-3 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={o.fulfilled} onChange={() => toggleFulfilled(o)} disabled={!o.paid} />
                      {o.fulfilled ? 'Done' : 'Pending'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ProductForm({ product, onDone, onCancel }) {
  const [f, setF] = useState({
    name: product?.name || '', description: product?.description || '', image: product?.image || '',
    price: product ? (product.price / 100).toFixed(2) : '', sizes: (product?.sizes || ['S', 'M', 'L', 'XL', '2XL']).join(', '),
  });
  const [err, setErr] = useState('');
  const [imgErr, setImgErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgErr('');
    const bad = validateFile(file, 8 * 1024 * 1024);
    if (bad) return setImgErr(bad);
    try {
      setF((x) => ({ ...x, image: '' }));
      const image = await resizeImage(file, { maxDim: 1000, quality: 0.85 });
      setF((x) => ({ ...x, image }));
    } catch {
      setImgErr('Could not read this image. Try a JPG or PNG.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const body = {
      name: f.name, description: f.description, image: f.image,
      price: Math.round(parseFloat(f.price || '0') * 100),
      sizes: f.sizes.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (product) await api.patch(`/shop/products/${product.id}`, body);
      else await api.post('/shop/products', body);
      onDone();
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Could not save this T-shirt.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-5 p-5 border border-[var(--line)] rounded-[var(--radius)] space-y-4 bg-[var(--brand-surface)]">
      <h3 className="font-display text-lg text-[var(--brand-ink)]">{product ? 'Edit T-shirt' : 'New T-shirt'}</h3>
      {err && <p role="alert" className="text-sm text-[var(--brand-danger)] font-semibold">{err}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label htmlFor="pr-name" className={label}>Name</label><Input id="pr-name" value={f.name} onChange={set('name')} maxLength={200} /></div>
        <div><label htmlFor="pr-price" className={label}>Price (₱)</label><Input id="pr-price" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="300.00" /></div>
      </div>
      <div><label htmlFor="pr-sizes" className={label}>Sizes (comma separated)</label><Input id="pr-sizes" value={f.sizes} onChange={set('sizes')} /></div>
      <div><label htmlFor="pr-desc" className={label}>Description (optional)</label><Input id="pr-desc" as="textarea" rows="3" value={f.description} onChange={set('description')} /></div>
      <div>
        <span className={label}>Photo</span>
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full max-w-xs aspect-square rounded-[var(--radius)] bg-white border border-dashed border-[var(--line)] hover:border-[var(--brand-accent)] overflow-hidden flex flex-col items-center justify-center gap-2">
          {f.image ? <img src={f.image} alt="" className="w-full h-full object-cover" /> : (<><Upload className="text-slate-400" size={24} /><span className="text-xs font-semibold text-slate-500">Click to upload</span></>)}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
        {imgErr && <p className="text-sm text-[var(--brand-danger)] font-semibold mt-2">{imgErr}</p>}
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save T-shirt'}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function SettingsForm({ shop, onSaved }) {
  const [f, setF] = useState({ enabled: shop.enabled, fee_percent: String(shop.fee_percent), fulfillment: shop.fulfillment, pickup_info: shop.pickup_info || '' });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const { data } = await api.put('/shop/settings', { enabled: f.enabled, fee_percent: parseFloat(f.fee_percent), fulfillment: f.fulfillment, pickup_info: f.pickup_info });
      onSaved(data.shop);
      setMsg(data.shop.enabled ? 'Saved. The shop is open.' : 'Saved. The shop is closed.');
    } catch (e2) {
      setMsg(e2.response?.data?.error || 'Could not save the shop settings.');
    }
  };

  return (
    <Panel className="p-6">
      <form onSubmit={save} className="space-y-4">
        <h2 className="font-display text-xl text-[var(--brand-ink)]">Shop settings</h2>
        {msg && <p role="status" className="text-sm font-semibold text-[var(--navy)]">{msg}</p>}
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF((x) => ({ ...x, enabled: e.target.checked }))} /> Shop is open
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sh-ful" className={label}>Pickup or delivery</label>
            <Input as="select" id="sh-ful" value={f.fulfillment} onChange={set('fulfillment')}>
              <option value="pickup">Pickup</option>
              <option value="delivery">Free delivery</option>
            </Input>
          </div>
          {f.fulfillment === 'pickup' && (
            <div><label htmlFor="sh-pick" className={label}>Where to pick up</label><Input id="sh-pick" value={f.pickup_info} onChange={set('pickup_info')} /></div>
          )}
          <div><label htmlFor="sh-fee" className={label}>PayMongo fee (%) added to the customer's total</label><Input id="sh-fee" inputMode="decimal" value={f.fee_percent} onChange={set('fee_percent')} /></div>
        </div>
        <Button type="submit" variant="primary">Save settings</Button>
      </form>
    </Panel>
  );
}
