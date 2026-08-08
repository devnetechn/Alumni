import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft, Upload } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';

export default function Signup() {
  const [form, setForm] = useState({ name: '', slug: '', full_name: '', email: '', password: '' });
  const [logo, setLogo] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

  const onName = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: f.slug === slugify(f.name) ? slugify(name) : f.slug }));
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setLogo(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/platform/schools', { ...form, logo: logo || undefined });
      const rest = window.location.host;
      window.location.href = `${window.location.protocol}//${data.slug}.${rest}/login`;
    } catch (e) {
      setErr(e.response?.data?.error || 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[var(--brand-ink)] hover:text-[var(--brand-accent)] mb-6 text-sm font-bold">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <Panel className="p-8 lg:p-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <GraduationCap className="text-white" size={22} />
            </div>
            <Wordmark />
          </div>

          <h1 className="font-display text-3xl text-[var(--brand-ink)] mb-2">Set up your school</h1>
          <p className="text-slate-500 mb-8">Start a 30-day free trial — no payment required.</p>

          {err && (
            <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-5 text-sm">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">School Name</label>
              <Input value={form.name} onChange={onName} required />
            </div>

            <div>
              <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Subdomain</label>
              <div className="flex items-center gap-2">
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} required />
                <span className="text-sm text-slate-500 whitespace-nowrap">.{window.location.host}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Logo (optional)</label>
              <div className="flex items-center gap-3">
                {logo && <img src={logo} alt="" className="w-12 h-12 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] object-cover" />}
                <label className="inline-flex items-center gap-2 cursor-pointer border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-xs uppercase tracking-wide px-4 py-2.5 bg-white text-[var(--brand-ink)] shadow-[3px_3px_0_var(--brand-ink)]">
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                  <Upload size={16} /> Upload
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Your Name</label>
                <Input value={form.full_name} onChange={update('full_name')} />
              </div>
              <div>
                <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Your Email</label>
                <Input type="email" value={form.email} onChange={update('email')} required />
              </div>
              <div>
                <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Password</label>
                <Input type="password" value={form.password} onChange={update('password')} required />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : <>Start Free Trial <ArrowRight size={18} /></>}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have a school? <Link to="/login" className="text-[var(--brand-accent)] hover:underline font-bold">Sign in</Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
