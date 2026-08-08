import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Briefcase, GraduationCap, Tag, MessageSquare, Handshake } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input, Avatar } from '../components/ui';

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
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">Alumni Directory</h1>
        <p className="text-slate-500 mt-1">Find and connect with fellow alumni</p>
      </div>

      <Panel className="p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
            <Input
              className="pl-10"
              placeholder="Search name, company, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <Input className="md:w-32" placeholder="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} />
          <Input className="md:w-48" placeholder="Course" value={course} onChange={(e) => setCourse(e.target.value)} />
          <Button onClick={load}>Search</Button>
        </div>
        <div className="mt-3">
          <button onClick={() => setShowAdvanced((v) => !v)} className="text-sm text-[var(--brand-accent)] hover:underline font-bold">
            {showAdvanced ? 'Hide' : 'Show'} advanced filters
          </button>
        </div>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-[var(--brand-ink)] font-semibold">
              <input type="checkbox" checked={mentor} onChange={(e) => setMentor(e.target.checked)} />
              Mentors only
            </label>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {alumni.length === 0 && (
          <Panel className="col-span-full p-8 text-center text-slate-500">
            No alumni found.
          </Panel>
        )}
        {alumni.map((a) => (
          <Panel key={a.id} className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Avatar name={a.full_name} size="md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[var(--brand-ink)] truncate">{a.full_name}</h3>
                <p className="text-xs text-slate-500 truncate">{a.email}</p>
              </div>
              {a.mentor_available && (
                <span title="Mentor" className="text-[var(--brand-success)]"><Handshake size={18} /></span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <GraduationCap size={14} className="text-[var(--brand-accent)]" />
                <span>Batch {a.batch_year} · {a.course}</span>
              </div>
              {a.company && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase size={14} className="text-[var(--brand-accent)]" />
                  <span className="truncate">{a.position} @ {a.company}</span>
                </div>
              )}
              {a.industry && (
                <div className="text-xs text-slate-500">Industry: {a.industry}</div>
              )}
              {a.nfc_uid && (
                <div className="flex items-center gap-2 text-[var(--brand-success)]">
                  <Tag size={14} />
                  <span className="text-xs font-mono">{a.nfc_uid}</span>
                </div>
              )}
            </div>
            <Link to={`/messages?to=${a.user_id}`}>
              <Button variant="secondary" className="mt-4 w-full">
                <MessageSquare size={14} /> Message
              </Button>
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}
