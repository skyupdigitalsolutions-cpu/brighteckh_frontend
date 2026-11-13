// Figma "Tab bar" (register 177:102738, job workspace 177:116073) + "Shell / Tab" 33:741.
// Bar: glass, radius 28, px-24 py-6, gap 32; the register bar also has the glass shadow (`shadow`), the job
// workspace bar does not. Tab: pt-8, gap 6, label 14/20 (active Medium primary, default Regular secondary),
// 2px underline radius 1 (active = brand-logo).
// Counts: no Figma frame draws a count; when `count` is given it is appended as " · n" in the same label style
// (deviation, see report).
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cx } from './Icon';

export function TabBar({ children, shadow, className, label = 'Sections' }: { children: ReactNode; shadow?: boolean; className?: string; label?: string }) {
  return (
    <nav
      aria-label={label}
      className={cx('glass flex w-full items-start gap-[32px] overflow-x-auto overflow-y-clip rounded-t-card px-[24px] py-[6px]', shadow && 'shadow-glass', className)}
    >
      {children}
    </nav>
  );
}

function TabInner({ active, label, count }: { active: boolean; label: ReactNode; count?: number | null }) {
  return (
    <>
      <span className={cx('whitespace-nowrap text-[14px] leading-[20px]', active ? 'font-medium text-fg' : 'font-normal text-fg-2')}>
        {label}
        {count != null && <span className="font-mono"> · {count}</span>}
      </span>
      <span className={cx('h-[2px] w-full rounded-[1px]', active && 'bg-brand-logo')} aria-hidden />
    </>
  );
}

/** Button tab (local state). */
export function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: ReactNode; count?: number | null }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-[6px] pt-[8px]"
    >
      <TabInner active={active} label={label} count={count} />
    </button>
  );
}

/** Route tab (React Router). `end` = exact match. */
export function TabLink({ to, label, count, end }: { to: string; label: ReactNode; count?: number | null; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="flex shrink-0 flex-col items-center gap-[6px] pt-[8px]">
      {({ isActive }) => <TabInner active={isActive} label={label} count={count} />}
    </NavLink>
  );
}
