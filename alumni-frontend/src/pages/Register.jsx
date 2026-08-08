import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth';
import { Panel, Button, Input, Wordmark } from '../components/ui';

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
    <div className="min-h-screen bg-[var(--brand-surface)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[var(--brand-ink)] hover:text-[var(--brand-accent)] mb-6 text-sm font-bold">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <Panel className="p-8 lg:p-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] p-2 rounded-[var(--radius)]">
              <GraduationCap className="text-white" size={22} />
            </div>
            <Wordmark />
          </div>

          <h1 className="font-display text-3xl text-[var(--brand-ink)] mb-2">Create your account</h1>
          <p className="text-slate-500 mb-8">Join the alumni network and stay connected.</p>

          {err && (
            <div className="bg-white border-2 border-[var(--brand-danger)] text-[var(--brand-danger)] font-semibold p-3 rounded-[var(--radius)] mb-5 text-sm">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <Section title="Account">
              <Field label="Full Name" span>
                <Input value={form.full_name} onChange={update('full_name')} required />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={update('email')} required />
              </Field>
              <Field label="Password">
                <Input type="password" value={form.password} onChange={update('password')} required />
              </Field>
            </Section>

            <Section title="Academic">
              <Field label="Batch Year">
                <Input value={form.batch_year} onChange={update('batch_year')} placeholder="2020" />
              </Field>
              <Field label="Course">
                <Input value={form.course} onChange={update('course')} placeholder="BS Computer Science" />
              </Field>
            </Section>

            <Section title="Professional">
              <Field label="Contact">
                <Input value={form.contact} onChange={update('contact')} />
              </Field>
              <Field label="Industry">
                <Input value={form.industry} onChange={update('industry')} />
              </Field>
              <Field label="Company">
                <Input value={form.company} onChange={update('company')} />
              </Field>
              <Field label="Position">
                <Input value={form.position} onChange={update('position')} />
              </Field>
            </Section>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : <>Create Account <ArrowRight size={18} /></>}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account? <Link to="/login" className="text-[var(--brand-accent)] hover:underline font-bold">Sign in</Link>
          </p>
        </Panel>
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
      <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
