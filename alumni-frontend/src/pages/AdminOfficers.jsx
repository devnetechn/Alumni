import { useEffect, useRef, useState } from 'react';
import { Users, Trash2, Upload } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from '../components/ui';
import Avatar from '../components/ui/Avatar';
import { validateFile, resizeImage } from '../lib/media';

export default function AdminOfficers() {
  const [officers, setOfficers] = useState([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [photo, setPhoto] = useState('');
  const [err, setErr] = useState('');
  const [photoErr, setPhotoErr] = useState('');
  const fileRef = useRef(null);

  const load = () => api.get('/officers').then((r) => setOfficers(r.data.officers));

  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErr('');
    const validationErr = validateFile(file, 8 * 1024 * 1024);
    if (validationErr) {
      setPhotoErr(validationErr);
      return;
    }
    try {
      const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
      setPhoto(dataUrl);
    } catch {
      setPhotoErr('Could not read this image — try a different photo or format (e.g. JPG or PNG instead of HEIC).');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim() || !position.trim()) {
      setErr('Name and position are required');
      return;
    }
    try {
      await api.post('/officers', { name, position, photo: photo || null });
      setName('');
      setPosition('');
      setPhoto('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to add officer');
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this officer?')) return;
    await api.delete(`/officers/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Users className="text-[var(--brand-accent)]" /> Officers
        </h1>
        <p className="text-slate-500 mt-1">Manage the officers & board shown on the homepage and Officers page.</p>
      </div>

      <Panel className="p-6 mb-8">
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <p className="text-sm text-[var(--brand-danger)] font-semibold">{err}</p>}
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Position</label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. President" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Photo (optional)</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-40 h-40 rounded-[var(--radius)] bg-[var(--brand-surface)] border-2 border-dashed border-[var(--brand-ink)]/30 hover:border-[var(--brand-accent)] overflow-hidden flex flex-col items-center justify-center gap-2 transition-colors"
            >
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload className="text-slate-400" size={24} />
                  <span className="text-xs font-semibold text-slate-500">Click to upload</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
            {photoErr && <p className="text-sm text-[var(--brand-danger)] font-semibold mt-2">{photoErr}</p>}
            <p className="text-xs text-slate-500 mt-2">JPG or PNG, max 8MB. Auto-resized to 400px.</p>
          </div>
          <Button type="submit" variant="primary">Add Officer</Button>
        </form>
      </Panel>

      {officers.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500">No officers yet.</Panel>
      ) : (
        <div className="space-y-3">
          {officers.map((o) => (
            <Panel key={o.id} className="p-4 flex items-center gap-4">
              <Avatar name={o.name} pic={o.photo} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--brand-ink)] truncate">{o.name}</p>
                <p className="text-xs text-slate-500 truncate">{o.position}</p>
              </div>
              <button onClick={() => remove(o.id)} className="p-2 text-[var(--brand-danger)] hover:bg-red-50 rounded-[var(--radius)]">
                <Trash2 size={16} />
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
