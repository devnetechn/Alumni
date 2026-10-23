import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Button, Input } from '../components/ui';
import AuthSplit, { Field, FormAlert } from '../components/layout/AuthSplit';
import { resizeImage } from '../lib/media';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { school, register } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [batches, setBatches] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', batch_id: '', requested_year: '', course: '', profile_pic: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const notListed = form.batch_id === 'other';

  useEffect(() => { api.get('/batches').then((r) => setBatches(r.data.batches)).catch(() => setBatches([])); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const paid = school && school.registration_fee > 0;

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErrors((x) => ({ ...x, photo: 'Choose an image file.' }));
    if (file.size > 5 * 1024 * 1024) return setErrors((x) => ({ ...x, photo: 'Image must be under 5MB.' }));
    const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
    setErrors((x) => ({ ...x, photo: '' }));
    setForm((f) => ({ ...f, profile_pic: dataUrl }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Enter your full name.';
    if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.password.length < 8) e.password = 'Use at least 8 characters.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    if (!form.batch_id) e.batch_id = 'Select your graduation batch.';
    if (notListed && !/^(19|20)\d{2}$/.test(form.requested_year)) e.requested_year = 'Enter a four-digit graduation year.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    const payload = {
      full_name: form.full_name.trim(), email: form.email.trim(), password: form.password,
      course: form.course.trim() || undefined, profile_pic: form.profile_pic || undefined,
      ...(notListed ? { requested_batch_year: form.requested_year } : { batch_id: Number(form.batch_id) }),
    };
    try {
      if (paid) {
        const { data } = await api.post('/registration/signup-checkout', payload);
        window.location.href = data.checkoutUrl;
        return;
      }
      await register(payload);
      nav('/membership');
    } catch (e) {
      setFormError(e.response?.data?.error || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const closed = school && !school.registration_open;
  const err = (k) => errors[k] || undefined;
  const aria = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-error` : undefined });

  return (
    <AuthSplit
      title="Join the alumni community"
      subtitle="Create your account and request to join your graduating batch."
      footer={<>Already a member? <Link to="/login" className="font-semibold text-[var(--navy)] underline decoration-[var(--gold)] underline-offset-4">Sign in</Link></>}
    >
      {closed ? <FormAlert>Registration is currently closed. Please check back later.</FormAlert> : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormAlert>{formError}</FormAlert>
          {paid && <p className="text-sm bg-[var(--paper-2)] border border-[var(--line)] p-3 rounded-[var(--radius)]">Registration fee: <strong>₱{(school.registration_fee / 100).toFixed(2)}</strong>. You will be taken to a secure payment page after submitting.</p>}

          <Field label="Full name" id="full_name" error={err('full_name')}>
            <Input id="full_name" autoComplete="name" value={form.full_name} onChange={set('full_name')} {...aria('full_name')} />
          </Field>
          <Field label="Email address" id="email" error={err('email')}>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} {...aria('email')} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Password" id="password" error={err('password')} hint="At least 8 characters.">
              <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} {...aria('password')} />
            </Field>
            <Field label="Confirm password" id="confirm" error={err('confirm')}>
              <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} {...aria('confirm')} />
            </Field>
          </div>

          <Field label="Graduation batch" id="batch_id" error={err('batch_id')} hint="Your batch president reviews your request before you can enter the private community.">
            <Input as="select" id="batch_id" value={form.batch_id} onChange={set('batch_id')} {...aria('batch_id')}>
              <option value="">{batches === null ? 'Loading batches…' : 'Select your batch'}</option>
              {(batches || []).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.year})</option>)}
              <option value="other">My batch is not listed</option>
            </Input>
          </Field>
          {notListed && (
            <div className="border-l-2 border-[var(--gold)] pl-4 space-y-3">
              <p className="text-sm text-[var(--muted)]">Tell us your graduation year. You can still register, and the association administrator is notified so your batch can be created. You will not have batch access until it exists and your request is approved.</p>
              <Field label="Graduation year" id="requested_year" error={err('requested_year')}>
                <Input id="requested_year" inputMode="numeric" maxLength={4} value={form.requested_year} onChange={set('requested_year')} {...aria('requested_year')} />
              </Field>
            </div>
          )}

          <Field label="Course or department (optional)" id="course">
            <Input id="course" value={form.course} onChange={set('course')} />
          </Field>

          <Field label="Profile photo (optional)" id="photo" error={errors.photo}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[var(--paper-2)] border border-[var(--line)] overflow-hidden flex items-center justify-center text-xs text-[var(--muted)] shrink-0">
                {form.profile_pic ? <img src={form.profile_pic} alt="Your profile preview" className="w-full h-full object-cover" /> : 'No photo'}
              </div>
              <input ref={fileRef} id="photo" type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={15} aria-hidden="true" /> Upload</Button>
              {form.profile_pic && <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, profile_pic: '' }))} aria-label="Remove photo"><Trash2 size={16} /></Button>}
            </div>
          </Field>

          <Button type="submit" variant="navy" disabled={loading} className="w-full !py-3">{loading ? 'Submitting…' : paid ? 'Continue to payment' : 'Create account & request membership'}</Button>
        </form>
      )}
    </AuthSplit>
  );
}
