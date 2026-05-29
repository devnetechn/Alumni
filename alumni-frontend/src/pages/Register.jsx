import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', batch_year: '', course: '', contact: '', company: '', position: '', industry: ''
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await register({ ...form, batch_year: form.batch_year ? parseInt(form.batch_year) : null });
      nav('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'Register failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 text-sm font-medium">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 lg:p-10 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
              <GraduationCap className="text-white" size={22} />
            </div>
            <span className="font-bold text-slate-900">Alumni System</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-500 mb-8">Join the alumni network and stay connected.</p>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-5 text-sm">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <Section title="Account">
              <Field label="Full Name" span>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.full_name} onChange={update('full_name')} required />
              </Field>
              <Field label="Email">
                <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.email} onChange={update('email')} required />
              </Field>
              <Field label="Password">
                <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.password} onChange={update('password')} required />
              </Field>
            </Section>

            <Section title="Academic">
              <Field label="Batch Year">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.batch_year} onChange={update('batch_year')} placeholder="2020" />
              </Field>
              <Field label="Course">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.course} onChange={update('course')} placeholder="BS Computer Science" />
              </Field>
            </Section>

            <Section title="Professional">
              <Field label="Contact">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.contact} onChange={update('contact')} />
              </Field>
              <Field label="Industry">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.industry} onChange={update('industry')} />
              </Field>
              <Field label="Company">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.company} onChange={update('company')} />
              </Field>
              <Field label="Position">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.position} onChange={update('position')} />
              </Field>
            </Section>

            <button
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? 'Creating...' : <>Create Account <ArrowRight size={18} /></>}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account? <Link to="/login" className="text-indigo-600 hover:underline font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
