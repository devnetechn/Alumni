import { useRef, useState } from 'react';
import { BookOpen, Upload } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Panel, Button, Input } from '../components/ui';
import { validateFile, resizeImage } from '../lib/media';

export default function AdminOverview() {
  const { school } = useAuth();
  // Mount the form only once the school has loaded so its fields can start from saved values.
  return school ? <OverviewForm school={school} /> : null;
}

function OverviewForm({ school }) {
  const { refreshSchool } = useAuth();
  const [title, setTitle] = useState(school.overview_title || '');
  const [body, setBody] = useState(school.overview_body || '');
  const [image, setImage] = useState(school.overview_image || '');
  const [err, setErr] = useState('');
  const [imgErr, setImgErr] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgErr('');
    const validationErr = validateFile(file, 8 * 1024 * 1024);
    if (validationErr) {
      setImgErr(validationErr);
      return;
    }
    try {
      setImage(await resizeImage(file, { maxDim: 1200, quality: 0.85 }));
    } catch {
      setImgErr('Could not read this image — try a different photo or format (e.g. JPG or PNG instead of HEIC).');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaved(false);
    try {
      await api.patch('/school', { overview_title: title, overview_body: body, overview_image: image });
      await refreshSchool();
      setSaved(true);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save overview');
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <BookOpen className="text-[var(--gold-deep)]" /> Homepage overview
        </h1>
        <p className="text-slate-500 mt-1">The story shown right below the hero: reconnecting alumni and proof that the community is alive.</p>
      </div>

      <Panel className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <p className="text-sm text-[var(--brand-danger)] font-semibold">{err}</p>}
          {saved && <p role="status" className="text-sm text-green-700 font-semibold">Saved.</p>}
          <div>
            <label htmlFor="ov-title" className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Title</label>
            <Input id="ov-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ov-body" className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Text</label>
            <Input id="ov-body" as="textarea" rows="8" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Image (optional)</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full max-w-sm aspect-[4/3] rounded-[var(--radius)] bg-[var(--brand-surface)] border border-dashed border-[var(--line)]/30 hover:border-[var(--brand-accent)] overflow-hidden flex flex-col items-center justify-center gap-2 transition-colors"
            >
              {image ? (
                <img src={image} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload className="text-slate-400" size={24} />
                  <span className="text-xs font-semibold text-slate-500">Click to upload</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
            {imgErr && <p className="text-sm text-[var(--brand-danger)] font-semibold mt-2">{imgErr}</p>}
            {image && <button type="button" onClick={() => { setImage(''); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-slate-500 underline mt-2">Remove image</button>}
          </div>
          <Button type="submit" variant="primary">Save overview</Button>
        </form>
      </Panel>
    </div>
  );
}
