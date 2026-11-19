// Local pieces for the stage-C screens (POUT0/POUT1 PS-D 238:41629 · FI0/FI1/FI2 F-D 247:51039).
// - ListCard (POUT0 "Table card" 246:49756 / FI0 247:51509): glass-strong, radius 24, p-16, NO shadow, fills the column.
// - ListToolbar (246:49748 / 247:51501): glass-strong, radius 30, pl-16 pr-10 py-10, gap 10, no shadow (kit ToolbarCard
//   is glass + p-10 + shadow, so it's local).
// - HeadRow / Row / Cell: header row bg-subtle radius 18, px-14 py-10, gap 10 (12/16 SemiBold +0.24 secondary); list rows
//   px-14 py-13, gap 10, 1px bottom border; detail rows (POUT1 246:51195, FI1 247:52578) py-9; selected = brand-subtle +
//   1px brand-border, radius 14.
// - SplitCard (POUT1 "Outward" 246:51178 / "Panel" 246:51247, FI1 "Invoice" 247:52558 p-22 / "Side" 247:52633): glass-strong,
//   radius 24, p-20, gap 12. CardHead = Desktop/H2 18/24; PanelHead = Desktop/H3 15/20.
// - KVBox ("Dispatch" 246:51234, "Bill to" 247:52636): bg-subtle radius 16, px-16 py-12, gap 8; 14/20 label secondary
//   flex-1, value Medium primary.
// - OptionChips (Evidence kind 246:51569): px-12 py-8, radius 16, 11/14 SemiBold +0.44; selected brand-subtle + brand-border.
// - OpenQuestion (FI1 "Open question G13" 247:52621): warning-bg, 1px warning-border, radius 14, px-14 py-10, gap 10,
//   16px alert icon, 12/16 warning-fg. Used for BR-11 CLIENT-UNCONFIRMED decisions (not API gaps → those are GapNote).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Ic, cx } from '../../../ui/desktop';

export function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="glass-strong flex w-full shrink-0 items-center gap-[10px] overflow-clip rounded-[30px] py-[10px] pl-[16px] pr-[10px]">
      {children}
    </div>
  );
}

export function ListCard({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <div className={cx('glass-strong flex min-h-[560px] w-full flex-1 flex-col items-stretch overflow-clip rounded-[24px] p-[16px]', center && 'items-center justify-center')}>
      {children}
    </div>
  );
}

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <div role="row" className="flex w-full shrink-0 items-start gap-[10px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
      {children}
    </div>
  );
}

export function Th({ w, grow, right, children }: { w?: number; grow?: boolean; right?: boolean; children: ReactNode }) {
  return (
    <div role="columnheader" className={cx('flex items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', right && 'justify-end')} style={grow ? undefined : { width: w }}>
      <span className="truncate whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
}

export function Td({ w, grow, right, children, className }: { w?: number; grow?: boolean; right?: boolean; children: ReactNode; className?: string }) {
  return (
    <div role="cell" className={cx('flex min-w-0 items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', right && 'justify-end', className)} style={grow ? undefined : { width: w }}>
      {children}
    </div>
  );
}


const rowBase = 'flex w-full shrink-0 items-center gap-[10px] overflow-clip px-[14px] text-left';

/** POUT0 / FI0 list row (py-13). Navigable when `to` is set. */
export function ListRow({ to, state, children }: { to?: string; state?: unknown; children: ReactNode }) {
  const cls = cx(rowBase, 'border-b border-line py-[13px] transition-colors hover:bg-surface');
  return to ? <Link role="row" to={to} state={state} className={cls}>{children}</Link> : <div role="row" className={cls}>{children}</div>;
}

/** POUT1 / FI1 inner-table row (py-9); `selected` = brand-subtle + brand-border, radius 14. */
export function DetailRow({ selected, onSelect, children }: { selected?: boolean; onSelect?: () => void; children: ReactNode }) {
  const cls = cx(rowBase, 'py-[9px]', selected ? 'rounded-[14px] border border-brand-border bg-brand-subtle' : 'border-b border-line', onSelect && !selected && 'hover:bg-surface');
  if (!onSelect) return <div role="row" className={cls}>{children}</div>;
  return <button type="button" role="row" aria-selected={selected} onClick={onSelect} className={cls}>{children}</button>;
}

export function SplitCard({ children, className, pad = 20 }: { children: ReactNode; className?: string; pad?: 20 | 22 }) {
  return (
    <div className={cx('glass-strong flex flex-col items-start gap-[12px] self-stretch overflow-clip rounded-[24px]', pad === 22 ? 'p-[22px]' : 'p-[20px]', className)}>
      {children}
    </div>
  );
}

export function CardHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{children}</h2>
      {right}
    </div>
  );
}

export function PanelHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[15px] font-semibold leading-[20px] text-fg">{children}</h2>
      {right}
    </div>
  );
}

export function KVBox({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="flex w-full flex-col items-start gap-[8px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px] text-[14px] leading-[20px]">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex w-full items-start gap-[10px] overflow-clip">
          <p className="min-w-px flex-1 text-fg-2">{k}</p>
          <p className="min-w-0 truncate text-right font-medium text-fg">{v ?? '—'}</p>
        </div>
      ))}
    </div>
  );
}

export function OptionChips<V extends string>({ label, value, options, onChange }: {
  label: ReactNode; value: V | null; options: readonly V[]; onChange: (v: V) => void;
}) {
  return (
    <div role="radiogroup" className="flex w-full flex-col items-start gap-[8px] overflow-clip">
      <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</p>
      <div className="flex w-full flex-wrap content-start items-start gap-[8px]">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              className={cx(
                'flex items-start overflow-clip whitespace-nowrap rounded-[16px] border px-[12px] py-[8px] text-[11px] font-semibold leading-[14px] tracking-[0.44px]',
                on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface',
              )}
            >
              {o.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OpenQuestion({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border border-warn-border bg-warn-bg px-[14px] py-[10px]">
      <Ic icon={IconAlertTriangle} size={16} className="text-warn-fg" />
      <p className="min-w-px flex-1 text-[12px] leading-[16px] text-warn-fg">{code} · CLIENT-UNCONFIRMED — {children}</p>
    </div>
  );
}

/** Loading bars for split detail screens. */
export function Bars({ widths }: { widths: number[] }) {
  return <>{widths.map((w, i) => <span key={i} className="block h-[12px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}</>;
}
