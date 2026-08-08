import { forwardRef } from 'react';

const base = 'inline-flex items-center justify-center gap-2 border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-xs uppercase tracking-wide px-4 py-2.5 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0';

const variants = {
  primary: 'bg-[var(--brand-accent)] text-white shadow-[3px_3px_0_var(--brand-ink)]',
  secondary: 'bg-white text-[var(--brand-ink)] shadow-[3px_3px_0_var(--brand-ink)]',
  ghost: 'bg-transparent text-[var(--brand-ink)] border-transparent shadow-none px-2 py-1',
  danger: 'bg-[var(--brand-danger)] text-white shadow-[3px_3px_0_var(--brand-ink)]',
};

const Button = forwardRef(({ variant = 'primary', className = '', ...props }, ref) => (
  <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
));
Button.displayName = 'Button';
export default Button;
