import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Trash2, Briefcase, MapPin, Building2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import PosterBadge from '../components/PosterBadge';

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
          <h1 className="text-3xl font-bold text-slate-900">Job Board</h1>
          <p className="text-slate-500 mt-1">Career opportunities shared by our alumni</p>
        </div>
        {user ? (
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors">
            {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> Post Job</>}
          </button>
        ) : (
          <Link to="/login" className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors">
            Login to post
          </Link>
        )}
      </div>

      {showForm && user && (
        <form onSubmit={submit} className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 grid grid-cols-2 gap-4">
          <input className="border border-slate-300 rounded-lg px-3 py-2.5 col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <select className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
            <option value="job">Full-time / Part-time</option>
            <option value="internship">Internship</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_referral} onChange={(e) => setForm({ ...form, is_referral: e.target.checked })} />
            Referral (I can refer applicants)
          </label>
          <textarea className="border border-slate-300 rounded-lg px-3 py-2.5 col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" rows="4" placeholder="Job description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="col-span-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg font-semibold transition-colors">Post</button>
        </form>
      )}

      <div className="mb-5 flex gap-2">
        {['', 'job', 'internship'].map((t) => (
          <button key={t || 'all'} onClick={() => setFilter(t)} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${filter === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
            {t === '' ? 'All' : t === 'job' ? 'Jobs' : 'Internships'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {jobs.length === 0 && (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            No job postings yet.
          </div>
        )}
        {jobs.map((j) => (
          <div key={j.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-lg hover:border-indigo-300 transition-all group">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl">
                <Briefcase className="text-white" size={20} />
              </div>
              {user && (user.role === 'admin' || user.email === j.poster_email) && (
                <button onClick={() => remove(j.id)} className="text-slate-400 hover:text-red-600 p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{j.title}</h3>
              {j.job_type === 'internship' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Internship</span>}
              {j.is_referral && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Referral</span>}
            </div>
            {j.company && (
              <div className="flex items-center gap-1.5 text-sm text-slate-700 font-semibold mt-1">
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
            <div className="mt-4 pt-4 border-t border-slate-100">
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
          </div>
        ))}
      </div>
    </>
  );

  // If logged in, shell layout wraps us. If not, we need our own container.
  if (user) {
    return <div className="p-6 lg:p-10 max-w-7xl mx-auto">{content}</div>;
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
              <Briefcase className="text-white" size={20} />
            </div>
            <span className="font-bold text-slate-900">Alumni System</span>
          </Link>
          <Link to="/login" className="px-5 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors text-sm">Login</Link>
        </div>
      </header>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">{content}</div>
    </div>
  );
}
