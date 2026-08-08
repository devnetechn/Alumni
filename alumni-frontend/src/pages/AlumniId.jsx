import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, GraduationCap } from 'lucide-react';
import { api } from '../api';
import { Button, Panel } from '../components/ui';

export default function AlumniId() {
  const [me, setMe] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get('/me').then((r) => setMe(r.data.me));
  }, []);

  useEffect(() => {
    if (me && canvasRef.current) {
      const code = me.nfc_uid || `ALUMNI:${me.id}`;
      QRCode.toCanvas(canvasRef.current, code, { width: 150, margin: 1, color: { dark: '#111111', light: '#ffffff' } });
    }
  }, [me]);

  const print = () => window.print();

  if (!me) return <div className="p-8 text-slate-500">Loading...</div>;

  if (!me.full_name) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <Panel className="p-6 border-[var(--brand-danger)]">
          <p className="font-bold mb-1 text-[var(--brand-danger)]">Profile incomplete</p>
          <p className="text-sm text-slate-600">Please complete your profile first to generate your alumni ID card.</p>
        </Panel>
      </div>
    );
  }

  const initial = me.full_name[0].toUpperCase();

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="font-display text-3xl text-[var(--brand-ink)]">My Alumni ID</h1>
          <p className="text-slate-500 mt-1">Use this QR code for quick event check-in</p>
        </div>
        <Button onClick={print}>
          <Printer size={18} />
          Print
        </Button>
      </div>

      <div className="flex justify-center">
        <div id="id-card" className="relative bg-[var(--brand-ink)] text-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[6px_6px_0_var(--brand-accent)] w-full max-w-sm overflow-hidden">
          <div className="h-2 bg-[var(--brand-accent)]" />
          <div className="relative z-10 p-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <div className="bg-white/10 border border-white/30 p-1.5 rounded-[var(--radius)]">
                  <GraduationCap size={16} />
                </div>
                <p className="text-[10px] uppercase tracking-widest font-semibold">Alumni ID</p>
              </div>
              <span className="bg-[var(--brand-accent)] border border-white/30 px-2.5 py-1 rounded text-[10px] font-bold">
                Batch {me.batch_year || '—'}
              </span>
            </div>

            <div className="flex justify-center mb-4">
              <div className="w-32 h-32 rounded-[var(--radius)] bg-white/10 border-2 border-white/30 overflow-hidden flex items-center justify-center">
                {me.profile_pic ? (
                  <img src={me.profile_pic} alt={me.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-extrabold text-white">{initial}</span>
                )}
              </div>
            </div>

            <div className="text-center mb-4">
              <h2 className="text-xl font-extrabold leading-tight">{me.full_name}</h2>
              <p className="text-sm opacity-80 mt-0.5">{me.course || '—'}</p>
              {me.position && me.company && (
                <p className="text-xs opacity-70 mt-2">{me.position} @ {me.company}</p>
              )}
            </div>

            <div className="flex justify-center mb-4">
              <div className="bg-white p-2.5 rounded-[var(--radius)] border-2 border-white">
                <canvas ref={canvasRef} />
              </div>
            </div>

            <div className="pt-4 border-t border-white/20 flex justify-between items-center text-[10px] uppercase tracking-widest opacity-70">
              <span>ID: {me.nfc_uid || `A${me.id}`}</span>
              <span>Scan at events</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 mt-4 print:hidden">
        Tip: Add a profile photo in your Profile page to replace the initial.
      </p>

      <style>{`
        @media print {
          aside, header, button { display: none !important; }
          body, html { background: white !important; }
        }
      `}</style>
    </div>
  );
}
