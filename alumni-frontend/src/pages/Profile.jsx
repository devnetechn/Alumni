import { useEffect, useRef, useState } from 'react';
import { Radio, Save, UserCircle, CheckCircle2, XCircle, Upload, Trash2 } from 'lucide-react';
import { api } from '../api';

export default function Profile() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please select an image file' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Image too large (max 2MB)' });
      return;
    }
    // Resize to max 400px for avatar — keeps DB rows small
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setForm((f) => ({ ...f, profile_pic: dataUrl }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
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
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your personal and professional information</p>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-4 rounded-xl mb-6 border ${
          msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <MsgIcon size={20} />
          <span className="font-semibold">{msg.text}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden flex items-center justify-center text-white font-extrabold text-3xl flex-shrink-0">
            {form.profile_pic ? (
              <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
            ) : (
              (me.full_name || me.email)[0].toUpperCase()
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{me.full_name || 'Complete your profile'}</h2>
            <p className="text-slate-500">{me.email}</p>
            {me.role === 'admin' && <span className="inline-block mt-1 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">ADMIN</span>}
          </div>
        </div>

        {/* Photo */}
        <Section title="Profile Photo">
          <div className="col-span-2 flex items-center gap-5">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden flex items-center justify-center text-white font-extrabold text-4xl flex-shrink-0 border-4 border-white shadow-lg">
              {form.profile_pic ? (
                <img src={form.profile_pic} alt="" className="w-full h-full object-cover" />
              ) : (
                (form.full_name || me.email)[0].toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                >
                  <Upload size={16} /> Upload Photo
                </button>
                {form.profile_pic && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">JPG or PNG, max 2MB. Auto-resized to 400px.</p>
            </div>
          </div>
        </Section>

        {/* Personal */}
        <Section title="Personal Information" icon={UserCircle}>
          <Field label="Full Name" span>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.full_name || ''} onChange={update('full_name')} />
          </Field>
          <Field label="Contact">
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.contact || ''} onChange={update('contact')} />
          </Field>
          <Field label="Address">
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.address || ''} onChange={update('address')} />
          </Field>
        </Section>

        {/* Academic */}
        <Section title="Academic">
          <Field label="Batch Year">
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.batch_year || ''} onChange={update('batch_year')} />
          </Field>
          <Field label="Course">
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.course || ''} onChange={update('course')} />
          </Field>
        </Section>

        {/* Professional */}
        <Section title="Professional">
          <Field label="Company">
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.company || ''} onChange={update('company')} />
          </Field>
          <Field label="Position">
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.position || ''} onChange={update('position')} />
          </Field>
          <Field label="Industry" span>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.industry || ''} onChange={update('industry')} />
          </Field>
          <Field label="Bio" span>
            <textarea rows="3" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.bio || ''} onChange={update('bio')} placeholder="Tell other alumni about yourself..." />
          </Field>
          <Field label="Mentorship" span>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!form.mentor_available} onChange={(e) => setForm({ ...form, mentor_available: e.target.checked })} />
              I am available as a mentor
            </label>
          </Field>
        </Section>

        {/* NFC */}
        <Section title="Alumni Card">
          <Field label="NFC UID" span>
            <div className="flex gap-2">
              <input className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.nfc_uid || ''} onChange={update('nfc_uid')} placeholder="Tap scan or type manually" />
              <button type="button" onClick={scanNfc} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg font-semibold transition-colors">
                <Radio size={16} /> Scan
              </button>
            </div>
          </Field>
        </Section>

        <button className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
          <Save size={18} /> Save Changes
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
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
