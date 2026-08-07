import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MessageSquare, Search } from 'lucide-react';
import { api } from '../api';
import { getSocket } from '../socket';

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState([]);
  const [other, setOther] = useState(null);
  const [body, setBody] = useState('');
  const [alumniList, setAlumniList] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const scrollRef = useRef(null);
  const [searchParams] = useSearchParams();

  const loadConvos = () => api.get('/messages').then((r) => setConversations(r.data.conversations));
  useEffect(() => { loadConvos(); }, []);

  useEffect(() => {
    const to = searchParams.get('to');
    if (to) openThread(parseInt(to));
  }, [searchParams]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewMessage = (message) => {
      loadConvos();
      if (active && (message.sender_id === active || message.receiver_id === active)) {
        openThread(active);
      }
    };
    socket.on('message:new', onNewMessage);
    return () => socket.off('message:new', onNewMessage);
  }, [active]);

  const openThread = async (userId) => {
    setActive(userId);
    const { data } = await api.get(`/messages/${userId}`);
    setThread(data.messages);
    setOther(data.other);
    setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 50);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || !active) return;
    await api.post('/messages', { receiver_id: active, body });
    setBody('');
    openThread(active);
    loadConvos();
  };

  const searchAlumni = async (q) => {
    setSearchQ(q);
    if (!q) return setAlumniList([]);
    const { data } = await api.get('/alumni', { params: { search: q } });
    setAlumniList(data.alumni.slice(0, 8));
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Messages</h1>
        <p className="text-slate-500 mt-1">Chat with fellow alumni</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sidebar */}
        <div className="w-80 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setSearching(!searching)}
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg font-semibold text-sm"
            >
              <MessageSquare size={16} />
              {searching ? 'Cancel' : 'New Message'}
            </button>
          </div>

          {searching && (
            <div className="p-3 border-b border-slate-200">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search alumni..."
                  value={searchQ}
                  onChange={(e) => searchAlumni(e.target.value)}
                />
              </div>
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {alumniList.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { openThread(a.user_id); setSearching(false); setSearchQ(''); setAlumniList([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-sm"
                  >
                    <p className="font-semibold text-slate-900">{a.full_name}</p>
                    <p className="text-xs text-slate-500">{a.email}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && !searching && (
              <p className="p-6 text-center text-sm text-slate-500">No messages yet. Click "New Message" to start.</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.other_id}
                onClick={() => openThread(c.other_id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${active === c.other_id ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {(c.other_name || c.other_email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-slate-900 truncate">{c.other_name || c.other_email}</p>
                      {c.unread_count > 0 && (
                        <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{c.unread_count}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.last_body}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-slate-200">
                <p className="font-bold text-slate-900">{other?.full_name || other?.email}</p>
                <p className="text-xs text-slate-500">Batch {other?.batch_year || '—'} · {other?.course || ''}</p>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50">
                {thread.map((m) => {
                  const mine = m.receiver_id === active;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md px-4 py-2.5 rounded-2xl ${
                        mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-900 rounded-bl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                        <p className={`text-xs mt-1 ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={send} className="p-4 border-t border-slate-200 flex gap-2">
                <input
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Type a message..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 rounded-lg">
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
