import { useState } from 'react';
import { Bot, X, Send } from 'lucide-react';
import { api } from '../api';
import { Button, Input } from './ui';

function getVisitorId() {
  let id = localStorage.getItem('chat_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('chat_visitor_id', id);
  }
  return id;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || limitReached) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/chat', { history, message: text, visitorId: getVisitorId() });
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      if (err.response?.status === 429) {
        setLimitReached(true);
        setMessages((m) => [...m, { role: 'assistant', content: err.response.data.error }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: "Sorry, something went wrong. Please try again." }]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="mb-3 w-80 bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--brand-ink)] text-white">
            <span className="font-display text-sm">Ask us anything</span>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2 bg-[var(--brand-surface)]">
            {messages.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">
                Ask about upcoming events, job postings, or the community.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-[var(--radius)] border-2 border-[var(--brand-ink)] text-xs ${
                  m.role === 'user' ? 'bg-[var(--brand-accent)] text-white' : 'bg-white text-[var(--brand-ink)]'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="p-2 border-t-[2.5px] border-[var(--brand-ink)] flex gap-2">
            <Input
              className="text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={limitReached ? 'Question limit reached' : 'Type a question...'}
              disabled={sending || limitReached}
            />
            <Button type="submit" disabled={sending || limitReached} className="px-3">
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-[var(--radius)] bg-[var(--brand-accent)] border-[2.5px] border-[var(--brand-ink)] shadow-[4px_4px_0_var(--brand-ink)] flex items-center justify-center text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_var(--brand-ink)] transition-all"
        aria-label="Open AI chat"
      >
        {open ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
}
