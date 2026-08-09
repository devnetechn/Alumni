import { useEffect, useRef, useState } from 'react';
import { Radio, Save, UserCircle, CheckCircle2, XCircle, Upload, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Panel, Button, Input } from '../components/ui';
import { validateFile, resizeImage } from '../lib/media';

export default function Profile() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please select an image file' });
      return;
    }
    const err = validateFile(file, 2 * 1024 * 1024);
    if (err) {
      setMsg({ type: 'err', text: err });
      return;
    }
    const dataUrl = await resizeImage(file, { maxDim: 400, quality: 0.85 });
    setForm((f) => ({ ...f, profile_pic: dataUrl }));
  };

  const clearPhoto = () => setForm((f) => ({ ...f, profile_pic: '' }));

  useEffect(() => {
    api.get('/me').then((r) => {
      setMe(r.data.me);
      setForm(r.data.me || {});
    });
  }, []);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const { data } = await api.put('/me', {
        ...form,
        batch_year: form.batch_year ? parseInt(form.batch_year) : null,
      });
      setMe(data.me);
      setMsg({ type: 'ok', text: 'Profile updated successfully!' });
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Update failed' });
    }
  };

  const scanNfc = async () => {
    if (!('NDEFReader' in window)) {
      alert('Web NFC only works on Chrome Android.');
      return;
    }
    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = (ev) => {
        setForm((f) => ({ ...f, nfc_uid: ev.serialNumber }));
      };
    } catch (e) {
      alert('NFC scan failed: ' + e.message);
    }
  };

  if (!me) return <div className="p-8 text-slate-500">Loading...</div>;

  const MsgIcon = msg?.type === 'ok' ? CheckCircle2 : XCircle;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your personal and professional information</p>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-4 rounded-[var(--radius)] mb-6 border-2 font-semibold ${
          msg.type === 'ok' ? 'bg-white border-[var(--brand-success)] text-[var(--brand-success)]' : 'bg-white border-[var(--brand-danger)] text-[var(--brand-danger)]'
        }`}>
          <MsgIcon size={20} />
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <Panel className="p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-[var(--radius)] bg-[var(--brand-accent)] border-2 border-[var(--brand-ink)] overflow-hidden flex items-center justify-center text-white font-extrabold text-3xl flex-shrink-0">
            {form.profile_pic ? (
              <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
            ) : (
              (me.full_name || me.email)[0].toUpperCase()
            )}
          </div>
          <div>
            <h2 className="font-display text-2xl text-[var(--brand-ink)]">{me.full_name || 'Complete your profile'}</h2>
            <p className="text-slate-500">{me.email}</p>
            {me.role === 'admin' && <span className="inline-block mt-1 bg-[var(--brand-accent)] text-white text-xs px-2 py-0.5 rounded border-2 border-[var(--brand-ink)] font-bold">ADMIN</span>}
          </div>
        </Panel>

        <Section title="Profile Photo">
          <div className="col-span-2 flex items-center gap-5">
            <div className="w-24 h-24 rounded-[var(--radius)] bg-[var(--brand-accent)] border-[2.5px] border-[var(--brand-ink)] overflow-hidden flex items-center justify-center text-white font-extrabold text-4xl flex-shrink-0">
              {form.profile_pic ? (
                <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
              ) : (
                (form.full_name || me.email)[0].toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> Upload Photo
                </Button>
                {form.profile_pic && (
                  <Button type="button" variant="danger" onClick={clearPhoto}>
                    <Trash2 size={16} /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">JPG or PNG, max 2MB. Auto-resized to 400px.</p>
            </div>
          </div>
        </Section>

        <Section title="Personal Information" icon={UserCircle}>
          <Field label="Full Name" span>
            <Input value={form.full_name || ''} onChange={update('full_name')} />
          </Field>
          <Field label="Contact">
            <Input value={form.contact || ''} onChange={update('contact')} />
          </Field>
          <Field label="Address">
            <Input value={form.address || ''} onChange={update('address')} />
          </Field>
        </Section>

        <Section title="Academic">
          <Field label="Batch Year">
            <Input value={form.batch_year || ''} onChange={update('batch_year')} />
          </Field>
          <Field label="Course">
            <Input value={form.course || ''} onChange={update('course')} />
          </Field>
        </Section>

        <Section title="Professional">
          <Field label="Company">
            <Input value={form.company || ''} onChange={update('company')} />
          </Field>
          <Field label="Position">
            <Input value={form.position || ''} onChange={update('position')} />
          </Field>
          <Field label="Industry" span>
            <Input value={form.industry || ''} onChange={update('industry')} />
          </Field>
          <Field label="Bio" span>
            <Input as="textarea" rows="3" value={form.bio || ''} onChange={update('bio')} placeholder="Tell other alumni about yourself..." />
          </Field>
          <Field label="Mentorship" span>
            <label className="flex items-center gap-2 text-sm text-[var(--brand-ink)] font-semibold">
              <input type="checkbox" checked={!!form.mentor_available} onChange={(e) => setForm({ ...form, mentor_available: e.target.checked })} />
              I am available as a mentor
            </label>
          </Field>
        </Section>

        <Section title="Alumni Card">
          <Field label="NFC UID" span>
            <div className="flex gap-2">
              <Input className="font-mono" value={form.nfc_uid || ''} onChange={update('nfc_uid')} placeholder="Tap scan or type manually" />
              <Button type="button" onClick={scanNfc} className="flex-shrink-0">
                <Radio size={16} /> Scan
              </Button>
            </div>
          </Field>
        </Section>

        <Button type="submit">
          <Save size={18} /> Save Changes
        </Button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <Panel className="p-6">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </Panel>
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
