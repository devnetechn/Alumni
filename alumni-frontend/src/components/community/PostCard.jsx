import { useState } from 'react';
import { Heart, MessageCircle, Trash2, Megaphone } from 'lucide-react';
import { api } from '../../api';
import { Avatar, Badge, Button, Input } from '../ui';

export function timeAgo(date) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Comment({ c, replies, canDelete, onReply, onDelete }) {
  return (
    <li>
      <div className="flex gap-2.5">
        <Avatar name={c.author_name} pic={c.author_pic} size="xs" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="bg-[var(--paper-2)] rounded-[var(--radius)] px-3 py-2">
            <p className="text-xs font-semibold text-[var(--navy)]">{c.author_name || 'Member'} <span className="font-normal text-[var(--muted)]">· {timeAgo(c.created_at)}</span></p>
            <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">{c.body}</p>
          </div>
          <div className="flex gap-3 text-xs text-[var(--muted)] mt-1 ml-1">
            <button onClick={() => onReply(c)} className="hover:text-[var(--navy)] font-medium">Reply</button>
            {canDelete(c) && <button onClick={() => onDelete(c)} className="hover:text-[var(--brand-danger)] font-medium">Delete</button>}
          </div>
          {replies.length > 0 && (
            <ul className="mt-2 space-y-2 border-l border-[var(--line)] pl-3">
              {replies.map((r) => <Comment key={r.id} c={r} replies={[]} canDelete={canDelete} onReply={onReply} onDelete={onDelete} />)}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export default function PostCard({ batchId, post, me, isManager, onRemoved }) {
  const [p, setP] = useState(post);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState('');
  const base = `/batches/${batchId}/posts/${p.id}`;

  const loadComments = async () => {
    const { data } = await api.get(`${base}/comments`);
    setComments(data.comments);
  };

  const toggleComments = async () => {
    if (!open && comments === null) await loadComments().catch(() => setError('Could not load comments.'));
    setOpen(!open);
  };

  const like = async () => {
    try {
      const { data } = await api.post(`${base}/like`);
      setP((x) => ({ ...x, liked_by_me: data.liked, like_count: data.count }));
    } catch { setError('Could not update your reaction.'); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const { data } = await api.post(`${base}/comments`, { body: text, parent_id: replyTo?.id });
      setComments((cs) => [...(cs || []), data.comment]);
      setP((x) => ({ ...x, comment_count: x.comment_count + 1 }));
      setText(''); setReplyTo(null); setError('');
    } catch (err) { setError(err.response?.data?.error || 'Could not post your comment.'); }
  };

  const removeComment = async (c) => {
    await api.delete(`/batches/${batchId}/comments/${c.id}`);
    await loadComments();
    setP((x) => ({ ...x, comment_count: Math.max(0, x.comment_count - 1) }));
  };

  const removePost = async () => {
    if (!window.confirm('Delete this post?')) return;
    await api.delete(base);
    onRemoved(p.id);
  };

  const canDeleteComment = (c) => c.author_id === me.id || isManager;
  const top = (comments || []).filter((c) => !c.parent_id);

  return (
    <article className={`card p-5 ${p.kind === 'announcement' ? 'border-l-4 !border-l-[var(--gold)]' : ''}`}>
      <header className="flex items-start gap-3">
        <Avatar name={p.author_name} pic={p.author_pic} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--navy)]">{p.author_name || 'Member'}</p>
          <p className="text-xs text-[var(--muted)]"><time dateTime={p.created_at}>{timeAgo(p.created_at)}</time></p>
        </div>
        {p.kind === 'announcement' && <Badge tone="accent"><Megaphone size={11} aria-hidden="true" /> Announcement</Badge>}
        {(p.author_id === me.id || isManager) && (
          <button onClick={removePost} aria-label="Delete post" className="p-1.5 text-[var(--muted)] hover:text-[var(--brand-danger)]"><Trash2 size={16} /></button>
        )}
      </header>
      {p.body && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{p.body}</p>}
      {p.image && <img src={p.image} alt="Shared by a batch member" className="mt-3 w-full max-h-[480px] object-cover rounded-[var(--radius)]" loading="lazy" />}

      <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center gap-5 text-sm">
        <button onClick={like} aria-pressed={p.liked_by_me} className={`flex items-center gap-1.5 font-medium ${p.liked_by_me ? 'text-[var(--gold-deep)]' : 'text-[var(--muted)] hover:text-[var(--navy)]'}`}>
          <Heart size={17} fill={p.liked_by_me ? 'currentColor' : 'none'} aria-hidden="true" /> {p.like_count} <span className="sr-only">likes</span>
        </button>
        <button onClick={toggleComments} aria-expanded={open} className="flex items-center gap-1.5 font-medium text-[var(--muted)] hover:text-[var(--navy)]">
          <MessageCircle size={17} aria-hidden="true" /> {p.comment_count} <span className="sr-only">comments</span>
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-[var(--brand-danger)] mt-2">{error}</p>}

      {open && (
        <div className="mt-4 space-y-4">
          {comments && comments.length === 0 && <p className="text-sm text-[var(--muted)]">No comments yet. Start the conversation.</p>}
          <ul className="space-y-3">
            {top.map((c) => (
              <Comment key={c.id} c={c} replies={(comments || []).filter((r) => r.parent_id === c.id)} canDelete={canDeleteComment} onReply={setReplyTo} onDelete={removeComment} />
            ))}
          </ul>
          <form onSubmit={send} className="flex gap-2 items-start">
            <div className="flex-1">
              {replyTo && <p className="text-xs text-[var(--muted)] mb-1">Replying to {replyTo.author_name} · <button type="button" onClick={() => setReplyTo(null)} className="underline">cancel</button></p>}
              <Input aria-label="Write a comment" placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
            </div>
            <Button type="submit" variant="navy" className="!py-2.5">Send</Button>
          </form>
        </div>
      )}
    </article>
  );
}
