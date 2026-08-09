import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Panel, Button } from './ui';
import { validateFile, resizeImage, readAsDataUrl } from '../lib/media';

export default function EventPhotosManager({ eventId }) {
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);

  const loadPhotos = () => api.get(`/events/${eventId}/photos`).then((r) => setPhotos(r.data.photos));

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const onPhotoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file, 10 * 1024 * 1024);
    if (err) {
      alert(err);
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const media = isVideo ? await readAsDataUrl(file) : await resizeImage(file, { maxDim: 1200, quality: 0.8 });
    await api.post(`/events/${eventId}/photos`, { media, media_type: isVideo ? 'video' : 'image' });
    e.target.value = '';
    loadPhotos();
  };

  const deletePhoto = async (photoId) => {
    if (!confirm('Delete this photo/video?')) return;
    await api.delete(`/events/${eventId}/photos/${photoId}`);
    loadPhotos();
  };

  return (
    <Panel className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--brand-ink)]">Photos</h2>
        <input ref={fileRef} type="file" accept="image/*,video/*" className="sr-only" onChange={onPhotoFile} />
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Upload Photo/Video
        </Button>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-slate-500">No photos or videos yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-[var(--radius)] overflow-hidden border-2 border-[var(--brand-ink)] aspect-square">
              {p.media_type === 'video' ? (
                <video src={p.media} className="w-full h-full object-cover" preload="metadata" />
              ) : (
                <img src={p.media} alt="" className="w-full h-full object-cover" />
              )}
              <button
                onClick={() => deletePhoto(p.id)}
                className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 border-2 border-[var(--brand-ink)] rounded-[var(--radius)] text-[var(--brand-danger)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
