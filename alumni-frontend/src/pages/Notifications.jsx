import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { getSocket } from '../socket';
import { Button } from '../components/ui';
import { Empty, Loading } from '../components/PageHeader';

export default function Notifications() {
  const { setUnread } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.notifications);
      setUnread(data.unread);
    } catch { setError('Could not load notifications.'); }
  }, [setUnread]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('notification:new', load);
    return () => socket.off('notification:new', load);
  }, [load]);

  const markAll = async () => { await api.patch('/notifications', {}); load(); };
  const markOne = async (n) => { if (!n.read_at) { await api.patch(`/notifications/${n.id}`); load(); } };
  const unread = (items || []).filter((n) => !n.read_at).length;

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Inbox</p>
          <h1 className="serif text-3xl text-[var(--navy)]">Notifications</h1>
          <span className="gold-rule mt-4" />
        </div>
        {unread > 0 && <Button variant="secondary" onClick={markAll}><CheckCheck size={16} aria-hidden="true" /> Mark all read</Button>}
      </div>

      <div className="mt-8 space-y-3">
        {error && <p role="alert" className="text-[var(--brand-danger)]">{error}</p>}
        {items === null && !error ? <Loading /> : items && items.length === 0 ? <Empty title="No notifications yet">Membership decisions, announcements and replies will appear here.</Empty> : (items || []).map((n) => {
          const inner = (
            <>
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-[var(--gold)]'}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className={`text-sm ${n.read_at ? 'text-[var(--muted)]' : 'text-[var(--navy)] font-semibold'}`}>{n.title}{!n.read_at && <span className="sr-only"> (unread)</span>}</p>
                {n.body && <p className="text-sm text-[var(--muted)] mt-0.5">{n.body}</p>}
                <p className="text-xs text-[var(--muted)] mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </>
          );
          return n.link ? (
            <Link key={n.id} to={n.link} onClick={() => markOne(n)} className="card card-hover p-4 flex gap-3">{inner}</Link>
          ) : (
            <button key={n.id} onClick={() => markOne(n)} className="card p-4 flex gap-3 text-left w-full">{inner}</button>
          );
        })}
      </div>
    </div>
  );
}
