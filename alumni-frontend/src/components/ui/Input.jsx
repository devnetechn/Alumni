import { createElement, forwardRef } from 'react';

const Input = forwardRef(({ as = 'input', className = '', ...props }, ref) => createElement(as, {
  ref,
  className: `w-full border border-[#C7CDD6] rounded-[var(--radius)] px-3 py-2.5 text-sm text-[var(--text)] bg-white focus:outline-none focus:border-[var(--navy-2)] focus:ring-2 focus:ring-[var(--gold)]/40 transition placeholder:text-slate-400 ${className}`,
  ...props,
}));
Input.displayName = 'Input';
export default Input;
