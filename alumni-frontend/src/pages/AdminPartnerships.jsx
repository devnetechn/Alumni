import { useEffect, useRef, useState } from 'react';
import { Handshake, Trash2, Upload, Building2 } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from '../components/ui';
import { validateFile, resizeImage } from '../lib/media';

export default function AdminPartnerships() {
  const [partners, setPartners] = useState([]);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logo, setLogo] = useState('');
  const [err, setErr] = useState('');
  const [logoErr, setLogoErr] = useState('');
  const fileRef = useRef(null);

  const load = () => api.get('/partners').then((r) => setPartners(r.data.partners));

  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoErr('');
    const validationErr = validateFile(file, 8 * 1024 * 1024);
    if (validationErr) {
      setLogoErr(validationErr);
      return;
    }
    try {
      const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
      setLogo(dataUrl);
    } catch {
      setLogoErr('Could not read this image — try a different photo or format (e.g. JPG or PNG instead of HEIC).');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    try {
      await api.post('/partners', { name, website_url: websiteUrl || null, logo: logo || null });
      setName('');
      setWebsiteUrl('');
      setLogo('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to add partner');
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this partner?')) return;
    await api.delete(`/partners/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Handshake className="text-[var(--brand-accent)]" /> Partnerships
        </h1>
        <p className="text-slate-500 mt-1">Manage the organizations shown on the homepage.</p>
      </div>

      <Panel className="p-6 mb-8">
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <p className="text-sm text-[var(--brand-danger)] font-semibold">{err}</p>}
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Website (optional)</label>
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Logo (optional)</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-40 h-40 rounded-[var(--radius)] bg-[var(--brand-surface)] border-2 border-dashed border-[var(--brand-ink)]/30 hover:border-[var(--brand-accent)] overflow-hidden flex flex-col items-center justify-center gap-2 transition-colors"
            >
              {logo ? (
                <img src={logo} alt="" className="w-full h-full object-contain p-4" />
              ) : (
                <>
                  <Upload className="text-slate-400" size={24} />
                  <span className="text-xs font-semibold text-slate-500">Click to upload</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
            {logoErr && <p className="text-sm text-[var(--brand-danger)] font-semibold mt-2">{logoErr}</p>}
            <p className="text-xs text-slate-500 mt-2">JPG or PNG, max 8MB. Auto-resized to 400px.</p>
          </div>
          <Button type="submit" variant="primary">Add Partner</Button>
        </form>
      </Panel>

      {partners.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500">No partners yet.</Panel>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => (
            <Panel key={p.id} className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--brand-surface)] border-2 border-[var(--brand-ink)] overflow-hidden flex items-center justify-center flex-shrink-0">
                {p.logo ? <img src={p.logo} alt="" className="w-full h-full object-cover" /> : <Building2 className="text-slate-400" size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--brand-ink)] truncate">{p.name}</p>
                {p.website_url && <p className="text-xs text-slate-500 truncate">{p.website_url}</p>}
              </div>
              <button onClick={() => remove(p.id)} className="p-2 text-[var(--brand-danger)] hover:bg-red-50 rounded-[var(--radius)]">
                <Trash2 size={16} />
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
