import { useEffect, useRef, useState } from 'react';
import { Images, Trash2, Upload } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from '../components/ui';
import { validateFile, resizeImage } from '../lib/media';

export default function AdminBatchGallery() {
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [photos, setPhotos] = useState([]);
  const [caption, setCaption] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/batches').then((r) => {
      setBatches(r.data.batches);
      if (r.data.batches.length) setBatchId(String(r.data.batches[0].id));
    });
  }, []);

  const load = (id) => api.get('/batch-gallery', { params: { batch_id: id } }).then((r) => setPhotos(r.data.photos));
  useEffect(() => {
    if (batchId) load(batchId);
  }, [batchId]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setErr('');
    setBusy(true);
    try {
      for (const file of files) {
        const validationErr = validateFile(file, 10 * 1024 * 1024);
        if (validationErr || !file.type.startsWith('image/')) {
          setErr(validationErr || 'Only images can be added to a batch gallery');
          continue;
        }
        const media = await resizeImage(file, { maxDim: 1600, quality: 0.82 });
        await api.post('/batch-gallery', { batch_id: Number(batchId), media, caption: caption || null });
      }
      setCaption('');
      await load(batchId);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not upload one of the photos');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this photo?')) return;
    await api.delete(`/batch-gallery/${id}`);
    load(batchId);
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <Images className="text-[var(--gold-deep)]" /> Batch gallery
        </h1>
        <p className="text-slate-500 mt-1">Photos shown per batch on the homepage.</p>
      </div>

      {batches.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500">Create a batch first.</Panel>
      ) : (
        <>
          <Panel className="p-6 mb-8 space-y-4">
            {err && <p className="text-sm text-[var(--brand-danger)] font-semibold">{err}</p>}
            <div>
              <label htmlFor="bg-batch" className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Batch</label>
              <Input as="select" id="bg-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Input>
            </div>
            <div>
              <label htmlFor="bg-caption" className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">Caption (optional, applies to this upload)</label>
              <Input id="bg-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload size={16} /> {busy ? 'Uploading…' : 'Upload photos'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={onFiles} />
          </Panel>

          {photos.length === 0 ? (
            <Panel className="p-8 text-center text-slate-500">No photos for this batch yet.</Panel>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-[4/3] rounded-[var(--radius)] overflow-hidden bg-[var(--paper-2)]">
                  <img src={p.media} alt={p.caption || p.batch_name} className="w-full h-full object-cover" />
                  <button onClick={() => remove(p.id)} aria-label="Remove photo" className="absolute top-2 right-2 p-2 bg-white/90 text-[var(--brand-danger)] rounded-[var(--radius)]">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
