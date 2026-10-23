import { useRef, useState } from 'react';
import { api } from '../api';
import { Button, Input, Panel } from './ui';
import { Field, FormAlert } from './layout/AuthSplit';
import { resizeImage } from '../lib/media';

const KINDS = [
  ['general', 'General'], ['homecoming', 'Alumni homecoming'], ['reunion', 'Batch reunion'],
  ['networking', 'Networking'], ['celebration', 'School celebration'],
];

export default function EventForm({ batchId, onCreated, onCancel }) {
  const [f, setF] = useState({ title: '', description: '', location: '', event_date: '', registration_deadline: '', capacity: '', kind: batchId ? 'reunion' : 'general', cover_image: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const cover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Cover must be an image.');
    setF((x) => ({ ...x, cover_image: '' }));
    setF((x) => ({ ...x }));
    const url = await resizeImage(file, { maxDim: 1200, quality: 0.82 });
    setF((x) => ({ ...x, cover_image: url }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.title.trim() || !f.event_date) return setError('A title and date are required.');
    if (f.registration_deadline && f.registration_deadline > f.event_date) return setError('The registration deadline must be before the event.');
    setBusy(true);
    try {
      const { data } = await api.post('/events', {
        ...f,
        event_date: new Date(f.event_date).toISOString(),
        registration_deadline: f.registration_deadline ? new Date(f.registration_deadline).toISOString() : undefined,
        capacity: f.capacity || undefined,
        cover_image: f.cover_image || undefined,
        batch_id: batchId || undefined,
      });
      onCreated(data.event);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the event.');
    } finally { setBusy(false); }
  };

  return (
    <Panel as="form" onSubmit={submit} className="p-6 space-y-4" noValidate>
      <h2 className="serif text-xl text-[var(--navy)]">New {batchId ? 'batch ' : ''}event</h2>
      <FormAlert>{error}</FormAlert>
      <Field label="Title" id="ev-title"><Input id="ev-title" value={f.title} onChange={set('title')} required /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Date and time" id="ev-date"><Input id="ev-date" type="datetime-local" value={f.event_date} onChange={set('event_date')} required /></Field>
        <Field label="Registration deadline" id="ev-deadline"><Input id="ev-deadline" type="datetime-local" value={f.registration_deadline} onChange={set('registration_deadline')} /></Field>
        <Field label="Location" id="ev-loc"><Input id="ev-loc" value={f.location} onChange={set('location')} /></Field>
        <Field label="Capacity (optional)" id="ev-cap"><Input id="ev-cap" type="number" min="1" value={f.capacity} onChange={set('capacity')} /></Field>
        <Field label="Type" id="ev-kind">
          <Input as="select" id="ev-kind" value={f.kind} onChange={set('kind')}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Input>
        </Field>
        <Field label="Cover image" id="ev-cover">
          <input ref={fileRef} id="ev-cover" type="file" accept="image/*" onChange={cover} className="text-sm" />
          {f.cover_image && <img src={f.cover_image} alt="Cover preview" className="mt-2 h-20 rounded" />}
        </Field>
      </div>
      <Field label="Description" id="ev-desc"><Input as="textarea" id="ev-desc" rows={3} value={f.description} onChange={set('description')} /></Field>
      <div className="flex gap-3">
        <Button type="submit" variant="navy" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Panel>
  );
}
