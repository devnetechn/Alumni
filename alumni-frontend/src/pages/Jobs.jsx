import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Trash2, Briefcase, MapPin, Building2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';
import { Panel, Button, Input, Badge, Wordmark } from '../components/ui';

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', description: '', job_type: 'job', is_referral: false });
  const [filter, setFilter] = useState('');

  const load = () => api.get('/jobs', { params: filter ? { type: filter } : {} }).then((r) => setJobs(r.data.jobs));
  useEffect(() => { load(); }, [filter]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/jobs', form);
    setForm({ title: '', company: '', location: '', description: '', job_type: 'job', is_referral: false });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this job posting?')) return;
    await api.delete(`/jobs/${id}`);
    load();
  };

  const content = (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">Job Board</h1>
          <p className="text-slate-500 mt-1">Career opportunities shared by our alumni</p>
        </div>
        {user ? (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> Post Job</>}
          </Button>
        ) : (
          <Link to="/login"><Button>Login to post</Button></Link>
        )}
      </div>

      {showForm && user && (
        <Panel as="form" onSubmit={submit} className="p-6 mb-6 grid grid-cols-2 gap-4">
          <Input className="col-span-2" placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input as="select" value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
            <option value="job">Full-time / Part-time</option>
            <option value="internship">Internship</option>
          </Input>
          <label className="flex items-center gap-2 text-sm text-[var(--brand-ink)] font-semibold">
            <input type="checkbox" checked={form.is_referral} onChange={(e) => setForm({ ...form, is_referral: e.target.checked })} />
            Referral (I can refer applicants)
          </label>
          <Input as="textarea" className="col-span-2" rows="4" placeholder="Job description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button type="submit" className="col-span-2">Post</Button>
        </Panel>
      )}

      <div className="mb-5 flex gap-2">
        {['', 'job', 'internship'].map((t) => (
          <button
            key={t || 'all'}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-[var(--radius)] text-sm font-bold border-2 ${filter === t ? 'bg-[var(--brand-accent)] text-white border-[var(--brand-ink)]' : 'bg-white border-[var(--brand-ink)] text-[var(--brand-ink)]'}`}
          >
            {t === '' ? 'All' : t === 'job' ? 'Jobs' : 'Internships'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {jobs.length === 0 && (
          <Panel className="col-span-full p-8 text-center text-slate-500">
            No job postings yet.
          </Panel>
        )}
        {jobs.map((j) => (
          <Panel key={j.id} className="p-6 group">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2.5 rounded-[var(--radius)]">
                <Briefcase className="text-white" size={20} />
              </div>
              {user && (user.role === 'admin' || user.email === j.poster_email) && (
                <button onClick={() => remove(j.id)} className="text-slate-400 hover:text-[var(--brand-danger)] p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-[var(--brand-ink)] group-hover:text-[var(--brand-accent)] transition-colors">{j.title}</h3>
              {j.job_type === 'internship' && <Badge tone="warning">Internship</Badge>}
              {j.is_referral && <Badge tone="success">Referral</Badge>}
            </div>
            {j.company && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--brand-ink)] font-semibold mt-1">
                <Building2 size={14} />
                {j.company}
              </div>
            )}
            {j.location && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                <MapPin size={14} />
                {j.location}
              </div>
            )}
            <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap line-clamp-3">{j.description}</p>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <PosterBadge
                name={j.poster_name}
                email={j.poster_email}
                pic={j.poster_pic}
                role={j.poster_role}
                subtitle={j.poster_position}
                date={new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                size="sm"
              />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );

  if (user) {
    return <div className="p-6 lg:p-10 max-w-7xl mx-auto">{content}</div>;
  }
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 bg-white border-b-[2.5px] border-[var(--brand-ink)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <Briefcase className="text-white" size={20} />
            </div>
            <Wordmark />
          </Link>
          <Link to="/login"><Button>Login</Button></Link>
        </div>
      </header>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">{content}</div>
    </div>
  );
}
