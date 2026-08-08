import { createElement, forwardRef } from 'react';

const Input = forwardRef(({ as = 'input', className = '', ...props }, ref) => createElement(as, {
  ref,
  className: `w-full border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--brand-accent)] focus:shadow-[3px_3px_0_var(--brand-accent)] transition-all placeholder:text-slate-400 ${className}`,
  ...props,
}));
Input.displayName = 'Input';
export default Input;
