import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, GraduationCap } from 'lucide-react';
import { api } from '../api';

export default function AlumniId() {
  const [me, setMe] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get('/me').then((r) => setMe(r.data.me));
  }, []);

  useEffect(() => {
    if (me && canvasRef.current) {
      const code = me.nfc_uid || `ALUMNI:${me.id}`;
      QRCode.toCanvas(canvasRef.current, code, { width: 150, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
    }
  }, [me]);

  const print = () => window.print();

  if (!me) return <div className="p-8 text-slate-500">Loading...</div>;

  if (!me.full_name) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl">
          <p className="font-bold mb-1">Profile incomplete</p>
          <p className="text-sm">Please complete your profile first to generate your alumni ID card.</p>
        </div>
      </div>
    );
  }

  const initial = me.full_name[0].toUpperCase();

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Alumni ID</h1>
          <p className="text-slate-500 mt-1">Use this QR code for quick event check-in</p>
        </div>
        <button onClick={print} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors">
          <Printer size={18} />
          Print
        </button>
      </div>

      <div className="flex justify-center">
        <div id="id-card" className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/30 rounded-full blur-3xl" />

          <div className="relative z-10 p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 backdrop-blur p-1.5 rounded-lg">
                  <GraduationCap size={16} />
                </div>
                <p className="text-[10px] uppercase tracking-widest font-semibold">Alumni ID</p>
              </div>
              <span className="bg-white/10 backdrop-blur border border-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold">
                Batch {me.batch_year || '—'}
              </span>
            </div>

            {/* Profile photo */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 p-1 shadow-xl">
                  <div className="w-full h-full rounded-full bg-white/10 backdrop-blur overflow-hidden flex items-center justify-center">
                    {me.profile_pic ? (
                      <img src={me.profile_pic} alt={me.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl font-extrabold text-white">{initial}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-extrabold leading-tight">{me.full_name}</h2>
              <p className="text-sm opacity-80 mt-0.5">{me.course || '—'}</p>
              {me.position && me.company && (
                <p className="text-xs opacity-70 mt-2">{me.position} @ {me.company}</p>
              )}
            </div>

            {/* QR code */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                <canvas ref={canvasRef} />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/20 flex justify-between items-center text-[10px] uppercase tracking-widest opacity-70">
              <span>ID: {me.nfc_uid || `A${me.id}`}</span>
              <span>Scan at events</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 mt-4 print:hidden">
        💡 Tip: Add a profile photo URL in your Profile page to replace the initial.
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
