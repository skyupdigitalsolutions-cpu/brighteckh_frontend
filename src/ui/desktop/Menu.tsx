// Menu surfaces.
// - MenuSurface: glass-strong, p-8, gap-2. variant "filter" (status/priority/date menus 177:106010 / 106649 /
//   107152) = radius 18 + shadow 0 16 40 /.45; variant "popover" (row menu 177:108933, notifications
//   177:110687, user 177:110906, search 177:111119) = radius 20 + shadow /.5.
// - OptionItem: single-select option (filter menus): px-12 py-10, radius 12; selected = brand-subtle fill,
//   14/20 Medium primary + 16px check (brand-text); otherwise 14/20 Regular secondary.
// - ActionItem: icon (18, secondary) + label 14/20 primary + optional 12/16 muted sub-line; gap 12, px-12 py-10.
import type { ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { cx, Ic, type TablerIcon } from './Icon';

export function MenuSurface({ variant = 'filter', className, children, gap = 2 }: {
  variant?: 'filter' | 'popover'; className?: string; children: ReactNode; gap?: 2 | 4;
}) {
  return (
    <div
      role="menu"
      className={cx(
        'glass-strong flex flex-col items-stretch overflow-clip p-[8px]',
        gap === 4 ? 'gap-[4px]' : 'gap-[2px]',
        variant === 'filter' ? 'rounded-t-chip shadow-menu' : 'rounded-t-popover shadow-popover',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function OptionItem({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'flex w-full items-center gap-[10px] rounded-t-field px-[12px] py-[10px] text-left text-[14px] leading-[20px]',
        selected ? 'bg-brand-subtle font-medium text-fg' : 'font-normal text-fg-2 hover:bg-subtle',
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {selected && <Ic icon={IconCheck} size={16} className="text-brand-text" />}
    </button>
  );
}

export function ActionItem({ icon, label, sub, onClick, tone = 'default', disabled }: {
  icon?: TablerIcon; label: ReactNode; sub?: ReactNode; onClick?: () => void; tone?: 'default' | 'brand'; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-center gap-[12px] rounded-t-field px-[12px] py-[10px] text-left',
        disabled ? 'cursor-not-allowed' : 'hover:bg-subtle',
      )}
    >
      {icon && <Ic icon={icon} size={18} className={tone === 'brand' ? 'text-brand-text' : 'text-fg-2'} />}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className={cx('whitespace-nowrap text-[14px] leading-[20px]', tone === 'brand' ? 'text-brand-text' : disabled ? 'text-fg-disabled' : 'text-fg')}>{label}</span>
        {sub && <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-muted">{sub}</span>}
      </span>
    </button>
  );
}

export function MenuDivider() {
  return <div className="h-px w-full shrink-0 bg-line" role="separator" />;
}
