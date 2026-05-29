import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Briefcase, GraduationCap, Tag, MessageSquare, Handshake } from 'lucide-react';
import { api } from '../api';

export default function Directory() {
  const [alumni, setAlumni] = useState([]);
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [course, setCourse] = useState('');
  const [industry, setIndustry] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [mentor, setMentor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = async () => {
    const { data } = await api.get('/alumni', {
      params: { search, batch, course, industry, company, location, mentor: mentor ? 1 : '' },
    });
    setAlumni(data.alumni);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Alumni Directory</h1>
        <p className="text-slate-500 mt-1">Find and connect with fellow alumni</p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search name, company, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <input className="border border-slate-300 rounded-lg px-3 py-2.5 w-full md:w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} />
          <input className="border border-slate-300 rounded-lg px-3 py-2.5 w-full md:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Course" value={course} onChange={(e) => setCourse(e.target.value)} />
          <button onClick={load} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors">
            Search
          </button>
        </div>
        <div className="mt-3">
          <button onClick={() => setShowAdvanced((v) => !v)} className="text-sm text-indigo-600 hover:underline">
            {showAdvanced ? 'Hide' : 'Show'} advanced filters
          </button>
        </div>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            <input className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <input className="border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={mentor} onChange={(e) => setMentor(e.target.checked)} />
              Mentors only
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {alumni.length === 0 && (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            No alumni found.
          </div>
        )}
        {alumni.map((a) => (
          <div key={a.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-lg hover:border-indigo-300 transition-all">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {a.full_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{a.full_name}</h3>
                <p className="text-xs text-slate-500 truncate">{a.email}</p>
              </div>
              {a.mentor_available && (
                <span title="Mentor" className="text-emerald-600"><Handshake size={18} /></span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <GraduationCap size={14} className="text-indigo-500" />
                <span>Batch {a.batch_year} · {a.course}</span>
              </div>
              {a.company && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase size={14} className="text-indigo-500" />
                  <span className="truncate">{a.position} @ {a.company}</span>
                </div>
              )}
              {a.industry && (
                <div className="text-xs text-slate-500">Industry: {a.industry}</div>
              )}
              {a.nfc_uid && (
                <div className="flex items-center gap-2 text-emerald-600">
                  <Tag size={14} />
                  <span className="text-xs font-mono">{a.nfc_uid}</span>
                </div>
              )}
            </div>
            <Link to={`/messages?to=${a.user_id}`} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 px-3 py-2 rounded-lg font-semibold text-sm transition-colors">
              <MessageSquare size={14} /> Message
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
