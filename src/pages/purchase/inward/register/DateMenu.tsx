// Register date filter ("Nov 2026" trigger 177:102755, menu frame 177:106948; applied Oct 2026 177:107164,
// Sep 2026 177:107367). Same trigger/option styling as the kit FilterMenu (kind="date"), but the menu is
// right-aligned under the trigger (Figma draws it against the toolbar's right edge; a start-aligned 200px menu
// would run off the page). Built locally because FilterMenu has no `align` prop.
// Options as drawn: current month, the two previous months, Last 7 days. "Custom range…" is NOT built (no frame
// designs the range picker) — see report.
import { IconCalendar } from '@tabler/icons-react';
import { formatMonthYear } from '../../../../lib/format';
import { cx, Ic, MenuSurface, OptionItem, Popover, useAnchor } from '../../../../ui/desktop';
import { monthStart, type DateKey } from './useInwardRegister';

export function dateOptions(now = new Date()): { value: DateKey; label: string }[] {
  return [
    { value: 'm0', label: formatMonthYear(monthStart(0, now)) },
    { value: 'm1', label: formatMonthYear(monthStart(1, now)) },
    { value: 'm2', label: formatMonthYear(monthStart(2, now)) },
    { value: '7d', label: 'Last 7 days' },
  ];
}

export function DateMenu({ value, onChange }: { value: DateKey; onChange: (v: DateKey) => void }) {
  const a = useAnchor<HTMLButtonElement>();
  const options = dateOptions();
  const current = options.find((o) => o.value === value);
  const applied = value !== 'm0'; // default = current month (unapplied look, as in 177:102755)
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
        )}
      >
        <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg">{current?.label}</span>
        <Ic icon={IconCalendar} size={16} className="text-fg-2" />
      </button>
      <Popover open={a.open} onClose={a.close} anchorRef={a.ref} align="end" scrim={0.25} width={200} label="Date">
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
