import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, GraduationCap, Search } from 'lucide-react';
import { api } from '../api';
import PageHeader, { Section, Empty, Loading } from '../components/PageHeader';
import { Avatar, Input } from '../components/ui';
import communityImg from '../assets/community.jpg';

export default function Directory() {
  const [filters, setFilters] = useState({ search: '', year: '', course: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState({ courses: [], years: [] });
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      api.get('/directory', { params })
        .then((r) => { setData(r.data.alumni); setError(''); setOptions((o) => (o.years.length || Object.keys(params).length ? o : { courses: r.data.courses, years: r.data.years })); })
        .catch(() => setError('Could not load the directory.'));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [filters]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader eyebrow="Alumni directory" title="Find a classmate" image={communityImg}>
        Only alumni approved by their batch president, and who choose to be listed, appear here.
      </PageHeader>
      <Section>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid sm:grid-cols-[1fr_180px_220px] gap-3 mb-10">
          <div className="relative">
            <label htmlFor="dir-search" className="sr-only">Search by name</label>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <Input id="dir-search" className="!pl-9" placeholder="Search by name" value={filters.search} onChange={set('search')} />
          </div>
          <div>
            <label htmlFor="dir-year" className="sr-only">Graduation year</label>
            <Input as="select" id="dir-year" value={filters.year} onChange={set('year')}><option value="">All years</option>{options.years.map((y) => <option key={y} value={y}>{y}</option>)}</Input>
          </div>
          <div>
            <label htmlFor="dir-course" className="sr-only">Course or department</label>
            <Input as="select" id="dir-course" value={filters.course} onChange={set('course')}><option value="">All courses</option>{options.courses.map((c) => <option key={c} value={c}>{c}</option>)}</Input>
          </div>
        </form>

        {error ? <p role="alert" className="text-[var(--brand-danger)]">{error}</p> : data === null ? <Loading /> : data.length === 0 ? (
          <Empty title="No alumni found">{Object.values(filters).some(Boolean) ? 'Try adjusting your search or filters.' : 'No approved alumni have been listed yet.'}</Empty>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.map((a) => (
              <li key={a.id}>
                <Link to={`/directory/${a.id}`} className="card card-hover p-6 flex flex-col items-center text-center h-full">
                  <Avatar name={a.full_name} pic={a.profile_pic} size="xl" />
                  <h3 className="serif text-lg text-[var(--navy)] mt-4 leading-snug">{a.full_name}</h3>
                  <span className="gold-rule !w-8 my-3" />
                  <p className="text-sm text-[var(--muted)] flex items-center gap-1.5"><GraduationCap size={14} aria-hidden="true" />Class of {a.batch_year || '—'}</p>
                  <p className="text-sm text-[var(--muted)] min-h-[1.25rem]">{a.course || ''}</p>
                  {a.location && <p className="text-xs text-[var(--muted)] mt-2 flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{a.location}</p>}
                  <span className="mt-auto pt-4 text-sm font-semibold text-[var(--navy)] border-b-2 border-[var(--gold)]">View profile</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export function DirectoryProfile() {
  const { id } = useParams();
  const [a, setA] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { api.get(`/directory/${id}`).then((r) => setA(r.data.alumnus)).catch(() => setMissing(true)); }, [id]);

  if (missing) return <Section><Empty title="Profile not available">This profile does not exist or is not public.</Empty></Section>;
  if (!a) return <Loading />;
  return (
    <Section>
      <div className="max-w-2xl mx-auto card p-8 md:p-10 text-center border-t-2 !border-t-[var(--gold)]">
        <Avatar name={a.full_name} pic={a.profile_pic} size="xl" className="mx-auto" />
        <h1 className="serif text-3xl text-[var(--navy)] mt-5">{a.full_name}</h1>
        <p className="text-[var(--muted)] mt-1">Class of {a.batch_year || '—'}{a.course ? ` · ${a.course}` : ''}</p>
        <span className="gold-rule mx-auto my-5" />
        {(a.position || a.company) && <p className="text-sm text-[var(--text)]">{[a.position, a.company].filter(Boolean).join(' at ')}</p>}
        {a.location && <p className="text-sm text-[var(--muted)] mt-1 flex items-center justify-center gap-1.5"><MapPin size={14} aria-hidden="true" />{a.location}</p>}
        {a.bio && <p className="text-[var(--muted)] mt-5 leading-relaxed whitespace-pre-line">{a.bio}</p>}
        <Link to="/directory" className="inline-block mt-8 text-sm font-semibold text-[var(--navy)] border-b-2 border-[var(--gold)]">Back to directory</Link>
      </div>
    </Section>
  );
}
