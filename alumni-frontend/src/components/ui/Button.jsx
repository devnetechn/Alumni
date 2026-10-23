import { forwardRef } from 'react';

const base = 'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold text-sm tracking-wide px-5 py-2.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

const variants = {
  primary: 'bg-[var(--gold)] text-[var(--navy)] hover:bg-[#f0b90f]',
  secondary: 'bg-white text-[var(--navy)] border border-[var(--line)] hover:border-[var(--navy)]',
  navy: 'bg-[var(--navy)] text-white hover:bg-[var(--navy-2)]',
  outline: 'bg-transparent text-white border border-white/60 hover:border-[var(--gold)] hover:text-[var(--gold)]',
  ghost: 'bg-transparent text-[var(--navy)] hover:bg-[var(--paper-2)] px-3 py-1.5',
  danger: 'bg-[var(--brand-danger)] text-white hover:bg-[#8f1c12]',
};

const Button = forwardRef(({ variant = 'primary', className = '', type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />
));
Button.displayName = 'Button';
export default Button;
