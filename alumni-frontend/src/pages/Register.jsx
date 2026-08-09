import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, ArrowLeft, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Panel, Button, Input, Wordmark } from '../components/ui';
import { validateFile, resizeImage } from '../lib/media';

export default function Register() {
  const { school } = useAuth();
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', batch_year: '', contact: '', address: '', member_type: 'alumnus'
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Please select an image file');
      return;
    }
    const err = validateFile(file, 2 * 1024 * 1024);
    if (err) {
      setErr(err);
      return;
    }
    const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
    setForm((f) => ({ ...f, profile_pic: dataUrl }));
  };

  const clearPhoto = () => setForm((f) => ({ ...f, profile_pic: '' }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.profile_pic) {
      setErr('Please upload a profile photo');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/registration/signup-checkout', {
        ...form,
        batch_year: form.batch_year ? parseInt(form.batch_year) : null,
      });
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setErr(e.response?.data?.error || 'Register failed');
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

          {school && !school.registration_open && (
            <div className="bg-white border-2 border-[var(--brand-ink)] text-[var(--brand-ink)] font-semibold p-4 rounded-[var(--radius)] mb-5 text-sm">
              Registration is currently closed. Please check back later.
            </div>
          )}

          {school && school.registration_open && school.registration_fee > 0 && (
            <div className="bg-[var(--brand-surface)] border-2 border-[var(--brand-ink)] p-4 rounded-[var(--radius)] mb-5 text-sm">
              Registration fee: <span className="font-bold">₱{(school.registration_fee / 100).toFixed(2)}</span> — you'll be redirected to complete payment after submitting this form.
            </div>
          )}

          {school && school.registration_open && school.registration_fee > 0 && (
          <form onSubmit={onSubmit} className="space-y-5">
            <Section title="Account">
              <Field label="Profile Photo" span>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-[var(--radius)] bg-[var(--brand-surface)] border-2 border-[var(--brand-ink)] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {form.profile_pic ? (
                      <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">No photo</span>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
                  <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                    <Upload size={16} /> Upload Photo
                  </Button>
                  {form.profile_pic && (
                    <Button type="button" variant="secondary" onClick={clearPhoto}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="Full Name" span>
                <Input value={form.full_name} onChange={update('full_name')} required />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={update('email')} required />
              </Field>
              <Field label="Password">
                <Input type="password" value={form.password} onChange={update('password')} required />
              </Field>
              <Field label="I am a">
                <Input as="select" value={form.member_type} onChange={update('member_type')}>
                  <option value="alumnus">Alumnus</option>
                  <option value="guest">Guest</option>
                </Input>
              </Field>
            </Section>

            <Section title="Details">
              <Field label="Batch Year">
                <Input value={form.batch_year} onChange={update('batch_year')} placeholder="2020" />
              </Field>
              <Field label="Contact">
                <Input value={form.contact} onChange={update('contact')} />
              </Field>
              <Field label="Address" span>
                <Input value={form.address} onChange={update('address')} />
              </Field>
            </Section>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Redirecting to payment...' : <>Continue to Payment <ArrowRight size={18} /></>}
            </Button>
          </form>
          )}

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
