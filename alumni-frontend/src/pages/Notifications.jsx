import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';
import { Panel, Button } from '../components/ui';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    const { data } = await api.get('/notifications');
    setItems(data.notifications);
    setUnread(data.unread);
  };

  const markAll = async () => {
    await api.patch('/notifications', {});
    load();
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewNotification = () => load();
    socket.on('notification:new', onNewNotification);
    return () => socket.off('notification:new', onNewNotification);
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)] flex items-center gap-2">
            <Bell className="text-[var(--brand-accent)]" /> Notifications
          </h1>
          <p className="text-slate-500 mt-1">{unread} unread</p>
        </div>
        {unread > 0 && (
          <Button onClick={markAll} className="text-sm">
            <CheckCheck size={16} /> Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <Panel className="p-8 text-center text-slate-500">
            No notifications yet.
          </Panel>
        )}
        {items.map((n) => (
          <Link key={n.id} to={n.link || '#'}>
            <Panel className={`p-5 transition-all ${n.read_at ? '' : 'shadow-[4px_4px_0_var(--brand-accent)] border-[var(--brand-accent)]'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.read_at ? 'bg-slate-300' : 'bg-[var(--brand-accent)]'}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--brand-ink)]">{n.title}</h3>
                    <span className="text-xs text-slate-400 capitalize">{n.type}</span>
                  </div>
                  {n.body && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
