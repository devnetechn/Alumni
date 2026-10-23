import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Home, Users, Megaphone, Image, CalendarDays, Settings, ShieldCheck, Lock } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import BatchCover from '../components/BatchCover';
import PostCard, { timeAgo } from '../components/community/PostCard';
import Composer from '../components/community/Composer';
import EventCard from '../components/EventCard';
import EventForm from '../components/EventForm';
import { Empty, Loading } from '../components/PageHeader';
import { Avatar, Badge, Button, Input } from '../components/ui';
import { FormAlert } from '../components/layout/AuthSplit';
import { resizeImage } from '../lib/media';

const TABS = [
  ['home', 'Batch Home', Home],
  ['members', 'Members', Users],
  ['announcements', 'Announcements', Megaphone],
  ['photos', 'Photos', Image],
  ['events', 'Events', CalendarDays],
];

function Feed({ batchId, me, isManager, query, composer, emptyTitle, emptyText }) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setPosts(null);
    api.get(`/batches/${batchId}/posts${query}`).then((r) => setPosts(r.data.posts)).catch(() => setError('Could not load posts.'));
  }, [batchId, query]);

  return (
    <div className="space-y-5">
      {composer && composer((post) => setPosts((p) => [post, ...(p || [])]))}
      <FormAlert>{error}</FormAlert>
      {posts === null && !error ? <Loading /> : posts && posts.length === 0 ? <Empty title={emptyTitle}>{emptyText}</Empty> : (posts || []).map((p) => (
        <PostCard key={p.id} batchId={batchId} post={p} me={me} isManager={isManager} onRemoved={(id) => setPosts((x) => x.filter((y) => y.id !== id))} />
      ))}
    </div>
  );
}

function Members({ batchId, isManager }) {
  const [q, setQ] = useState('');
  const [members, setMembers] = useState(null);
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => api.get(`/batches/${batchId}/members`, { params: { search: q || undefined } }).then((r) => setMembers(r.data.members)), 200);
    return () => clearTimeout(t.current);
  }, [batchId, q]);

  return (
    <div className="space-y-4">
      <label htmlFor="member-search" className="sr-only">Search members</label>
      <Input id="member-search" placeholder="Search members by name" value={q} onChange={(e) => setQ(e.target.value)} />
      {members === null ? <Loading /> : members.length === 0 ? <Empty title="No members found" /> : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {members.map((m) => (
            <li key={m.id} className="card p-4 flex items-center gap-3">
              <Avatar name={m.full_name} pic={m.profile_pic} />
              <div className="min-w-0">
                <p className="font-semibold text-[var(--navy)] truncate">{m.full_name || 'Member'}</p>
                <p className="text-xs text-[var(--muted)] truncate">{[m.position, m.company].filter(Boolean).join(' · ') || m.course || ' '}</p>
              </div>
              {m.is_president && <Badge tone="accent" className="ml-auto">President</Badge>}
            </li>
          ))}
        </ul>
      )}
      {isManager && <p className="text-xs text-[var(--muted)]">Manage members and requests from the <Link to="/president" className="underline">president dashboard</Link>.</p>}
    </div>
  );
}

function BatchEvents({ batchId, isManager }) {
  const [events, setEvents] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => { api.get(`/batches/${batchId}/events`).then((r) => setEvents(r.data.events)); }, [batchId]);
  return (
    <div className="space-y-5">
      {isManager && (show
        ? <EventForm batchId={batchId} onCancel={() => setShow(false)} onCreated={(e) => { setEvents((x) => [...(x || []), e]); setShow(false); }} />
        : <Button onClick={() => setShow(true)}>Create batch event</Button>)}
      {events === null ? <Loading /> : events.length === 0 ? <Empty title="No batch events yet">Reunions and gatherings for this batch will appear here.</Empty> : (
        <div className="grid sm:grid-cols-2 gap-5">{events.map((e) => <EventCard key={e.id} event={{ ...e, going_count: e.going_count || 0 }} />)}</div>
      )}
    </div>
  );
}

function BatchSettings({ batch, onSaved }) {
  const [description, setDescription] = useState(batch.description || '');
  const [cover, setCover] = useState(batch.cover_image || '');
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) setCover(await resizeImage(file, { maxDim: 1800, quality: 0.8 }));
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/batches/${batch.id}`, { description, cover_image: cover || null });
      setMsg({ error: '', ok: 'Saved.' });
      onSaved();
    } catch (err) { setMsg({ error: err.response?.data?.error || 'Could not save.', ok: '' }); }
  };
  return (
    <form onSubmit={save} className="card p-6 space-y-4">
      <h2 className="serif text-xl text-[var(--navy)]">Batch settings</h2>
      <FormAlert>{msg.error}</FormAlert>
      <FormAlert tone="ok">{msg.ok}</FormAlert>
      <div>
        <label htmlFor="b-desc" className="block text-sm font-semibold text-[var(--navy)] mb-1.5">Description</label>
        <Input as="textarea" id="b-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label htmlFor="b-cover" className="block text-sm font-semibold text-[var(--navy)] mb-1.5">Cover photograph</label>
        <input id="b-cover" type="file" accept="image/*" onChange={pick} className="text-sm" />
        {cover && <img src={cover} alt="Cover preview" className="mt-3 h-28 rounded object-cover" />}
      </div>
      <Button type="submit" variant="navy">Save changes</Button>
    </form>
  );
}

export default function BatchCommunity() {
  const { id } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'home';
  const [info, setInfo] = useState(null);
  const [denied, setDenied] = useState(false);
  const [side, setSide] = useState({ active: [], events: [], announcement: null });

  const load = useCallback(() => api.get(`/batches/${id}`).then((r) => {
    if (!r.data.isMember) setDenied(true); else setInfo(r.data);
  }).catch(() => setDenied(true)), [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!info) return;
    Promise.all([
      api.get(`/batches/${id}/active`),
      api.get(`/batches/${id}/events`),
      api.get(`/batches/${id}/posts`, { params: { kind: 'announcement' } }),
    ]).then(([a, e, p]) => setSide({
      active: a.data.members,
      events: e.data.events.filter((x) => new Date(x.event_date) >= new Date()).slice(0, 3),
      announcement: p.data.posts[0] || null,
    })).catch(() => {});
  }, [info, id]);

  if (denied) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <Lock size={32} className="mx-auto text-[var(--gold-deep)]" aria-hidden="true" />
        <h1 className="serif text-3xl text-[var(--navy)] mt-4">Private community</h1>
        <p className="text-[var(--muted)] mt-3">This space is only open to approved members of the batch. If you have requested to join, you will be notified when the batch president decides.</p>
        <div className="mt-6 flex gap-3 justify-center"><Link to={`/batches/${id}`}><Button>View batch page</Button></Link><Link to="/membership"><Button variant="secondary">My membership</Button></Link></div>
      </div>
    );
  }
  if (!info) return <Loading />;

  const { batch, canManage } = info;
  const tabs = canManage ? [...TABS, ['settings', 'Settings', Settings]] : TABS;
  const go = (t) => setParams(t === 'home' ? {} : { tab: t });

  return (
    <>
      <BatchCover batch={batch}>
        {canManage && <Link to="/president"><Button variant="outline"><ShieldCheck size={16} aria-hidden="true" /> Manage batch</Button></Link>}
      </BatchCover>

      <div className="bg-[var(--paper-2)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[220px_minmax(0,1fr)_290px] gap-6 items-start">
          <nav aria-label="Community sections" className="lg:sticky lg:top-24 flex lg:flex-col gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 card !border-0 lg:!border p-1 lg:p-2">
            {tabs.map(([key, label, Icon]) => (
              <button key={key} onClick={() => go(key)} aria-current={tab === key ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap rounded-[var(--radius)] border-l-2 transition-colors ${tab === key ? 'bg-[var(--navy)] text-white border-[var(--gold)]' : 'text-[var(--navy)] border-transparent hover:bg-[var(--paper-2)]'}`}>
                <Icon size={17} aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>

          <section aria-label={tabs.find((t) => t[0] === tab)?.[1]} className="min-w-0">
            {tab === 'home' && <Feed batchId={id} me={user} isManager={canManage} query="" emptyTitle="No posts yet" emptyText="Be the first to share something with your batch."
              composer={(add) => <Composer batchId={id} me={user} onPosted={add} />} />}
            {tab === 'announcements' && <Feed batchId={id} me={user} isManager={canManage} query="?kind=announcement" emptyTitle="No announcements yet" emptyText="Announcements from the batch president appear here."
              composer={canManage ? (add) => <Composer batchId={id} me={user} kind="announcement" placeholder="Write an announcement for the whole batch…" onPosted={add} /> : null} />}
            {tab === 'photos' && <Feed batchId={id} me={user} isManager={canManage} query="?photos=1" emptyTitle="No photos yet" emptyText="Photos shared in the community are collected here."
              composer={(add) => <Composer batchId={id} me={user} placeholder="Add a caption to your photo…" onPosted={add} />} />}
            {tab === 'members' && <Members batchId={id} isManager={canManage} />}
            {tab === 'events' && <BatchEvents batchId={id} isManager={canManage} />}
            {tab === 'settings' && canManage && <BatchSettings batch={batch} onSaved={load} />}
          </section>

          <aside className="space-y-5" aria-label="Batch information">
            <div className="card p-5 border-t-2 !border-t-[var(--gold)]">
              <p className="eyebrow mb-3">Batch president</p>
              {batch.president_name ? (
                <div className="flex items-center gap-3"><Avatar name={batch.president_name} pic={batch.president_pic} size="md" /><div><p className="font-semibold text-[var(--navy)]">{batch.president_name}</p><p className="text-xs text-[var(--muted)]">{batch.president_position || `Class of ${batch.year}`}</p></div></div>
              ) : <p className="text-sm text-[var(--muted)]">Not yet assigned.</p>}
            </div>
            {side.announcement && (
              <div className="card p-5">
                <p className="eyebrow mb-2">Important announcement</p>
                <p className="text-sm text-[var(--text)] line-clamp-4 whitespace-pre-wrap">{side.announcement.body}</p>
                <p className="text-xs text-[var(--muted)] mt-2">{timeAgo(side.announcement.created_at)}</p>
              </div>
            )}
            <div className="card p-5">
              <p className="eyebrow mb-3">Recently active</p>
              {side.active.length === 0 ? <p className="text-sm text-[var(--muted)]">No activity yet.</p> : (
                <ul className="space-y-3">{side.active.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5"><Avatar name={m.full_name} pic={m.profile_pic} size="sm" /><span className="text-sm text-[var(--navy)] font-medium truncate">{m.full_name}</span></li>
                ))}</ul>
              )}
            </div>
            <div className="card p-5">
              <p className="eyebrow mb-3">Upcoming batch events</p>
              {side.events.length === 0 ? <p className="text-sm text-[var(--muted)]">Nothing scheduled.</p> : (
                <ul className="space-y-3">{side.events.map((e) => (
                  <li key={e.id}><Link to={`/events/${e.id}`} className="text-sm font-semibold text-[var(--navy)] hover:underline">{e.title}</Link><p className="text-xs text-[var(--muted)]">{new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></li>
                ))}</ul>
              )}
            </div>
            <div className="card p-5">
              <p className="eyebrow mb-3">Shortcuts</p>
              <ul className="text-sm space-y-2 font-medium text-[var(--navy)]">
                <li><Link to="/directory" className="hover:underline">Alumni directory</Link></li>
                <li><Link to="/events" className="hover:underline">All association events</Link></li>
                <li><Link to="/messages" className="hover:underline">Messages</Link></li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
