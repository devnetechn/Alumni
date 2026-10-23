import { useEffect, useRef, useState } from 'react';
import { Button, Input } from './ui';

export default function ConfirmDialog({ title, message, confirmLabel, tone = 'navy', withNote, onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const go = async () => {
    setBusy(true);
    try { await onConfirm(note); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" className="bg-white max-w-md w-full rounded-[var(--radius)] p-6 border-t-2 border-[var(--gold)]" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title" className="serif text-xl text-[var(--navy)]">{title}</h2>
        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">{message}</p>
        {withNote && (
          <div className="mt-4">
            <label htmlFor="dlg-note" className="block text-sm font-semibold text-[var(--navy)] mb-1.5">Note to applicant (optional)</label>
            <Input as="textarea" id="dlg-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button ref={ref} variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={tone} disabled={busy} onClick={go}>{busy ? 'Working…' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
