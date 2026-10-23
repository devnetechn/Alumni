import Crest from './Crest';

// Single place every brand-mark location renders the association identity.
export default function Wordmark({ school, className = '', size = 40, showName = true, tone = 'light' }) {
  const name = school?.name || 'Alumni Association';
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {school?.logo
        ? <img src={school.logo} alt="" className="rounded-full object-cover bg-white" style={{ width: size, height: size }} />
        : <Crest size={size} />}
      {showName && (
        <span className={`serif text-[17px] leading-tight ${tone === 'light' ? 'text-white' : 'text-[var(--navy)]'}`}>
          {name}
        </span>
      )}
    </span>
  );
}
