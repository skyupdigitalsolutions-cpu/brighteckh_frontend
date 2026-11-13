// Toolbar filter dropdowns (Inward register: "Status: All", "Priority: All", "Nov 2026").
// Trigger (177:102749): surface fill, 1px border-default, h-40, pl-14 pr-12, radius 20, gap 8, label 14/20 primary,
// 16px trailing icon (chevron-down, or calendar for the date menu) in secondary.
// Applied state: the 2px brand inside-stroke Figma uses for the applied search field (177:107570).
// Menu: 8px below, left-aligned, 220px wide (177:106010), scrim rgba(0,0,0,.25). `align="end"` right-aligns the menu
// to the trigger (for filters on the right of a toolbar).
import { IconCalendar, IconChevronDown } from '@tabler/icons-react';
import { cx, Ic } from './Icon';
import { MenuSurface, OptionItem } from './Menu';
import { Popover, useAnchor } from './Popover';

export type FilterOption<V extends string> = { value: V; label: string };

export function FilterMenu<V extends string>({
  label, value, options, onChange, allValue, kind = 'select', menuWidth = 220, className, align = 'start',
}: {
  /** Prefix shown in the trigger, e.g. "Status" → "Status: All" / "Status: Verified". Omit for the date menu. */
  label?: string;
  value: V;
  options: FilterOption<V>[];
  onChange: (v: V) => void;
  /** The option that means "no filter"; any other value renders the applied state. */
  allValue: V;
  kind?: 'select' | 'date';
  menuWidth?: number;
  className?: string;
  /** Menu edge aligned to the trigger: 'start' (default, left) or 'end' (right). */
  align?: 'start' | 'end';
}) {
  const a = useAnchor<HTMLButtonElement>();
  const current = options.find((o) => o.value === value);
  const applied = value !== allValue;
  const text = label ? `${label}: ${applied ? current?.label ?? value : 'All'}` : current?.label ?? value;
  return (
    <>
      <button
        ref={a.ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={a.open}
        onClick={a.toggle}
        className={cx(
          'flex h-[40px] shrink-0 items-center gap-[8px] overflow-clip rounded-t-popover border border-line bg-surface pl-[14px] pr-[12px]',
          applied && 'ring-inside-brand',
          className,
        )}
      >
        <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg">{text}</span>
        <Ic icon={kind === 'date' ? IconCalendar : IconChevronDown} size={16} className="text-fg-2" />
      </button>
      <Popover open={a.open} onClose={a.close} anchorRef={a.ref} align={align} scrim={0.25} width={menuWidth} label={label ?? 'Date'}>
        <MenuSurface variant="filter">
          {options.map((o) => (
            <OptionItem key={o.value} selected={o.value === value} onSelect={() => { onChange(o.value); a.close(); }}>
              {o.label}
            </OptionItem>
          ))}
        </MenuSurface>
      </Popover>
    </>
  );
}
