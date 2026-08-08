// Placeholder platform wordmark. Once the real product name/logo is
// decided, this is the single place to swap it — every brand-mark
// location in the app renders this component.
export default function Wordmark({ className = '' }) {
  return (
    <span className={`font-display text-[15px] tracking-tight ${className}`}>
      [ ALUMNI/OS ]
    </span>
  );
}
