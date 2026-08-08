import { createElement } from 'react';

export default function Panel({ children, className = '', as = 'div', ...props }) {
  return createElement(
    as,
    { className: `bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] ${className}`, ...props },
    children,
  );
}
