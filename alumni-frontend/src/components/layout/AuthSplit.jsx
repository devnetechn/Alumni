import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../auth';
import { Wordmark } from '../ui';
import photo from '../../assets/community.jpg';

export default function AuthSplit({ title, subtitle, children, footer }) {
  const { school } = useAuth();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <aside className="relative hidden lg:flex flex-col justify-between bg-[var(--navy)] text-white on-dark p-12 overflow-hidden">
        <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy)] via-[var(--navy)]/70 to-[var(--navy)]/50" />
        <Link to="/" className="relative" aria-label="Home"><Wordmark school={school} size={48} /></Link>
        <div className="relative max-w-md">
          <span className="gold-rule mb-6" />
          <p className="serif text-4xl leading-tight">Once a student.<br />Always an alumni.</p>
          <p className="mt-5 text-white/75 leading-relaxed">Every graduating batch has its own identity and its own private space.</p>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-5 sm:px-10 py-10">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden mb-8 bg-[var(--navy)] -mx-5 sm:-mx-10 px-5 sm:px-10 py-4 on-dark">
            <Link to="/" aria-label="Home"><Wordmark school={school} size={38} /></Link>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--navy)] mb-6"><ArrowLeft size={15} aria-hidden="true" /> Back to home</Link>
          <h1 className="serif text-3xl text-[var(--navy)]">{title}</h1>
          <span className="gold-rule mt-4" />
          {subtitle && <p className="text-[var(--muted)] mt-4">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="text-center text-sm text-[var(--muted)] mt-8">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

export function Field({ label, id, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--navy)] mb-1.5">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-[var(--muted)] mt-1">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-[var(--brand-danger)] mt-1 font-medium">{error}</p>}
    </div>
  );
}

export function FormAlert({ children, tone = 'danger' }) {
  if (!children) return null;
  const cls = tone === 'danger' ? 'border-[#F3C4BF] bg-[#FDECEA] text-[#8F1C12]' : 'border-[#BFE3CF] bg-[#E8F5EE] text-[#14633A]';
  return <div role="alert" className={`border ${cls} rounded-[var(--radius)] px-4 py-3 text-sm mb-5`}>{children}</div>;
}
