import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../auth';
import { getSocket } from '../socket';
import { api } from '../api';

export default function NotificationBell({ className = '' }) {
  const { unread, setUnread } = useAuth();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = () => api.get('/notifications').then((r) => setUnread(r.data.unread)).catch(() => {});
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [setUnread]);

  return (
    <Link to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={`relative inline-flex p-2 rounded-full hover:bg-white/10 ${className}`}>
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--gold)] text-[var(--navy)] text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
