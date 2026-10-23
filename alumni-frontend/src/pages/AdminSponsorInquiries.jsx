import { useEffect, useState } from 'react';
import { HeartHandshake, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Panel } from '../components/ui';

export default function AdminSponsorInquiries() {
  const [items, setItems] = useState(null);

  const load = () => api.get('/sponsor/inquiries').then((r) => setItems(r.data.inquiries));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Delete this inquiry?')) return;
    await api.delete(`/sponsor/inquiries/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
          <HeartHandshake className="text-[var(--gold-deep)]" /> Sponsor inquiries
        </h1>
        <p className="text-slate-500 mt-1">Messages sent from the Sponsor page.</p>
      </div>
      {items === null ? null : items.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500">No inquiries yet.</Panel>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <Panel key={i.id} className="p-4 flex gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--brand-ink)]">{i.name}{i.organization ? ` · ${i.organization}` : ''}</p>
                <a href={`mailto:${i.email}`} className="text-sm text-[var(--navy)] underline">{i.email}</a>
                {i.message && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{i.message}</p>}
                <p className="text-xs text-slate-400 mt-2">{new Date(i.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => remove(i.id)} aria-label="Delete inquiry" className="p-2 h-fit text-[var(--brand-danger)] hover:bg-red-50 rounded-[var(--radius)]"><Trash2 size={16} /></button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
