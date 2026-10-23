import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { api } from '../../api';
import { Avatar, Button, Input } from '../ui';
import { resizeImage } from '../../lib/media';

export default function Composer({ batchId, me, kind = 'post', placeholder, onPosted }) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    if (file.size > 8 * 1024 * 1024) return setError('Image must be under 8MB.');
    setError('');
    setImage(await resizeImage(file, { maxDim: 1400, quality: 0.82 }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() && !image) return setError('Write something or attach a photo.');
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/batches/${batchId}/posts`, { body, image: image || undefined, kind });
      setBody(''); setImage('');
      onPosted(data.post);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not publish your post.');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="card p-4">
      <div className="flex gap-3">
        <Avatar name={me.full_name} pic={me.profile_pic} />
        <div className="flex-1 min-w-0">
          <label htmlFor={`composer-${kind}`} className="sr-only">{kind === 'announcement' ? 'Announcement' : 'Post'}</label>
          <Input as="textarea" id={`composer-${kind}`} rows={kind === 'announcement' ? 3 : 2} placeholder={placeholder || 'Share something with your batch…'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
          {image && (
            <div className="relative mt-3 inline-block">
              <img src={image} alt="Attachment preview" className="max-h-48 rounded-[var(--radius)]" />
              <button type="button" onClick={() => setImage('')} aria-label="Remove photo" className="absolute -top-2 -right-2 bg-[var(--navy)] text-white rounded-full p-1"><X size={14} /></button>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-[var(--brand-danger)] mt-2">{error}</p>}
          <div className="flex items-center justify-between mt-3">
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={pick} aria-label="Attach a photo" />
            <Button variant="ghost" onClick={() => fileRef.current?.click()}><ImagePlus size={17} aria-hidden="true" /> Photo</Button>
            <Button type="submit" variant="navy" disabled={busy} className="!py-2">{busy ? 'Posting…' : kind === 'announcement' ? 'Publish announcement' : 'Post'}</Button>
          </div>
        </div>
      </div>
    </form>
  );
}
