import { createElement, useEffect, useRef, useState } from 'react';
import { Trash2, Upload, Star } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from './ui';
import { validateFile, resizeImage } from '../lib/media';

// Shared admin screen for curated homepage content (projects, alumni stories).
// fields: [{ name, label, type: 'text' | 'textarea' | 'image' | 'batch', maxDim? }]
export default function AdminCuratedList({ icon, title, blurb, endpoint, listKey, fields, titleField, subtitleOf, imageField, featuredDefault }) {
  const blank = () => ({ ...Object.fromEntries(fields.map((f) => [f.name, ''])), featured: featuredDefault });
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const [fileErr, setFileErr] = useState('');
  const fileRefs = useRef({});

  const load = () => api.get(endpoint).then((r) => setItems(r.data[listKey]));
  useEffect(() => {
    load();
    if (fields.some((f) => f.type === 'batch')) api.get('/batches').then((r) => setBatches(r.data.batches));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const onFile = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr('');
    const validationErr = validateFile(file, 8 * 1024 * 1024);
    if (validationErr || !file.type.startsWith('image/')) {
      setFileErr(validationErr || 'Please select an image');
      return;
    }
    try {
      set(field.name, await resizeImage(file, { maxDim: field.maxDim || 1000, quality: 0.85 }));
    } catch {
      setFileErr('Could not read this image — try a different photo or format (e.g. JPG or PNG instead of HEIC).');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
      await api.post(endpoint, body);
      setForm(blank());
      Object.values(fileRefs.current).forEach((el) => { if (el) el.value = ''; });
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save');
    }
  };

  const toggleFeatured = async (item) => {
    await api.patch(`${endpoint}/${item.id}`, { featured: !item.featured });
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`${endpoint}/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          {createElement(icon, { className: 'text-[var(--gold-deep)]' })} {title}
        </h1>
        <p className="text-slate-500 mt-1">{blurb}</p>
      </div>

      <Panel className="p-6 mb-8">
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <p className="text-sm text-[var(--brand-danger)] font-semibold">{err}</p>}
          {fields.map((f) => (
            <div key={f.name}>
              <label htmlFor={`f-${f.name}`} className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">{f.label}</label>
              {f.type === 'image' ? (
                <>
                  <button type="button" onClick={() => fileRefs.current[f.name]?.click()} className="w-40 h-40 rounded-[var(--radius)] bg-[var(--brand-surface)] border border-dashed border-[var(--line)]/30 hover:border-[var(--brand-accent)] overflow-hidden flex flex-col items-center justify-center gap-2 transition-colors">
                    {form[f.name] ? <img src={form[f.name]} alt="" className="w-full h-full object-cover" /> : <><Upload className="text-slate-400" size={24} /><span className="text-xs font-semibold text-slate-500">Click to upload</span></>}
                  </button>
                  <input id={`f-${f.name}`} ref={(el) => { fileRefs.current[f.name] = el; }} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(f, e)} />
                </>
              ) : f.type === 'textarea' ? (
                <Input id={`f-${f.name}`} as="textarea" rows="5" value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} />
              ) : f.type === 'batch' ? (
                <Input id={`f-${f.name}`} as="select" value={form[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">None</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Input>
              ) : (
                <Input id={`f-${f.name}`} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} required={f.name === titleField} />
              )}
            </div>
          ))}
          {fileErr && <p className="text-sm text-[var(--brand-danger)] font-semibold">{fileErr}</p>}
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-ink)]">
            <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} /> Show on the homepage
          </label>
          <Button type="submit" variant="primary">Add</Button>
        </form>
      </Panel>

      {items.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500">Nothing here yet.</Panel>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Panel key={item.id} className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--brand-surface)] border border-[var(--line)] overflow-hidden flex items-center justify-center flex-shrink-0">
                {item[imageField] ? <img src={item[imageField]} alt="" className="w-full h-full object-cover" /> : createElement(icon, { className: 'text-slate-400', size: 18 })}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--brand-ink)] truncate">{item[titleField]}</p>
                <p className="text-xs text-slate-500 truncate">{subtitleOf(item)}</p>
              </div>
              <button onClick={() => toggleFeatured(item)} aria-pressed={item.featured} aria-label={item.featured ? 'Hide from homepage' : 'Show on homepage'} className={`p-2 rounded-[var(--radius)] ${item.featured ? 'text-[var(--gold-deep)]' : 'text-slate-300'}`}>
                <Star size={16} fill={item.featured ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => remove(item.id)} aria-label="Delete" className="p-2 text-[var(--brand-danger)] hover:bg-red-50 rounded-[var(--radius)]"><Trash2 size={16} /></button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
