// Single place every brand-mark location in the app renders the product
// name — swap it here to change it everywhere.
export default function Wordmark({ className = '' }) {
  return (
    <span className={`font-display text-[15px] tracking-tight ${className}`}>
      IHES Alumni Association
    </span>
  );
}
