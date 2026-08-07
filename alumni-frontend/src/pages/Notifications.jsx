import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';

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
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="text-indigo-600" /> Notifications
          </h1>
          <p className="text-slate-500 mt-1">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            No notifications yet.
          </div>
        )}
        {items.map((n) => (
          <Link
            key={n.id}
            to={n.link || '#'}
            className={`block bg-white p-5 rounded-2xl border transition-all ${n.read_at ? 'border-slate-200' : 'border-indigo-300 bg-indigo-50/40'}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 ${n.read_at ? 'bg-slate-300' : 'bg-indigo-600'}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{n.title}</h3>
                  <span className="text-xs text-slate-400 capitalize">{n.type}</span>
                </div>
                {n.body && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{n.body}</p>}
                <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
