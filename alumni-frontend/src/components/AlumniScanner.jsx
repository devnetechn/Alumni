import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, Nfc, Square } from 'lucide-react';
import { api } from '../api';
import { Panel, Button } from './ui';

const SCANNER_ELEMENT_ID = 'alumni-scanner-camera';
const DUPLICATE_COOLDOWN_MS = 3000;

export default function AlumniScanner({ eventId, onCheckedIn }) {
  const [scanning, setScanning] = useState(false);
  const [banner, setBanner] = useState(null); // { type: 'ok' | 'err', text: string }
  const html5QrCodeRef = useRef(null);
  const lastCodeRef = useRef({ code: null, at: 0 });
  const submittingRef = useRef(false);

  const submitCode = async (code) => {
    if (!code || submittingRef.current) return;
    const now = Date.now();
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < DUPLICATE_COOLDOWN_MS) {
      return;
    }
    lastCodeRef.current = { code, at: now };
    submittingRef.current = true;
    try {
      await api.post(`/events/${eventId}/checkin`, { code });
      setBanner({ type: 'ok', text: 'Checked in ✓' });
      onCheckedIn();
    } catch (err) {
      setBanner({ type: 'err', text: err.response?.data?.error || 'Check-in failed' });
    } finally {
      submittingRef.current = false;
      setTimeout(() => setBanner(null), 2500);
    }
  };

  useEffect(() => {
    if (!scanning) return undefined;

    const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID);
    html5QrCodeRef.current = html5QrCode;
    let cancelled = false;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => { submitCode(decodedText); },
        () => {} // per-frame decode misses; ignore
      )
      .catch((err) => {
        if (!cancelled) setBanner({ type: 'err', text: 'Camera failed to start: ' + err });
      });

    return () => {
      cancelled = true;
      try {
        // stop() throws synchronously (not a rejected promise) if the
        // scanner never reached a running state, e.g. camera permission
        // was denied or start() hadn't resolved yet.
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
      } catch {
        // nothing to stop
      }
      html5QrCodeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, eventId]);

  const scanNfc = async () => {
    if (!('NDEFReader' in window)) {
      alert('Web NFC only works on Chrome Android.');
      return;
    }
    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = (ev) => { submitCode(ev.serialNumber); };
    } catch (e) {
      alert('NFC scan failed: ' + e.message);
    }
  };

  return (
    <Panel className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--brand-ink)]">Scan Alumni</h2>
        {'NDEFReader' in window && (
          <Button type="button" variant="secondary" onClick={scanNfc}>
            <Nfc size={16} />
            Scan NFC Tag
          </Button>
        )}
      </div>

      {banner && (
        <div
          className={`mb-4 p-3 rounded-[var(--radius)] border-2 font-semibold text-sm ${
            banner.type === 'ok'
              ? 'bg-[var(--brand-success)]/10 border-[var(--brand-success)] text-[var(--brand-success)]'
              : 'bg-[var(--brand-danger)]/10 border-[var(--brand-danger)] text-[var(--brand-danger)]'
          }`}
        >
          {banner.text}
        </div>
      )}

      {scanning ? (
        <div>
          <div id={SCANNER_ELEMENT_ID} className="rounded-[var(--radius)] overflow-hidden border-[2.5px] border-[var(--brand-ink)]" />
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setScanning(false)}>
            <Square size={16} />
            Stop Scanning
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setScanning(true)}>
          <ScanLine size={16} />
          Start Camera Scan
        </Button>
      )}
    </Panel>
  );
}
