// Placeholder crest — swap for the official logo by uploading a school logo
// (school.logo takes precedence everywhere Crest is rendered through Wordmark).
export default function Crest({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 56" className={className} role="img" aria-label="Alumni association crest">
      <path d="M24 2 L44 9 V28 C44 40 35 49 24 54 C13 49 4 40 4 28 V9 Z" fill="#071B35" stroke="#FFC928" strokeWidth="2" />
      <path d="M24 9 L38 14 V28 C38 36 32 43 24 47 C16 43 10 36 10 28 V14 Z" fill="none" stroke="#FFC928" strokeWidth="0.8" opacity="0.7" />
      <path d="M24 17 L33 21 L24 25 L15 21 Z" fill="#FFC928" />
      <path d="M19 24 V30 C19 32.5 21.5 34 24 34 C26.5 34 29 32.5 29 30 V24 L24 26.2 Z" fill="#FFC928" />
      <path d="M17 40 H31" stroke="#FFC928" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
