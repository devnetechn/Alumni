import { createElement } from 'react';

export default function Panel({ children, className = '', as = 'div', ...props }) {
  return createElement(
    as,
    { className: `bg-white border border-[var(--line)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] ${className}`, ...props },
    children,
  );
}
