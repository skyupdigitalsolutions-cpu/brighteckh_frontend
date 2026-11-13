// Table building blocks from "Table card" (177:102758).
// TableCard: glass-strong, radius 28, p-16, glass shadow, column flex (fills remaining height with `fill`).
// THead: bg-subtle, radius 20, px-16 py-12; TH = 12/16 SemiBold secondary, +0.24px tracking.
// TR: px-16 py-14, 1px bottom border-default; hover = bg-surface (row "JIN-00031" in the success frame).
// TD widths are fixed px (Figma cells), one cell may `grow` (flex-1). Column widths must match header and rows,
// so pass the same `w` to TH and TD. Cell text presets: id (Data/ID 13/18 mono Medium), text (14/20 secondary),
// strong (14/20 Medium primary), small (12/16 secondary), number (Data/Number 14/20 mono).
// Also: ToolbarCard (177:102743), UnitsProgress (Units verified bar 72×6), SkeletonRows (177:102979).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './Icon';

export function TableCard({ children, className, fill }: { children: ReactNode; className?: string; fill?: boolean }) {
  return (
    <div className={cx('glass-strong flex w-full flex-col items-stretch overflow-clip rounded-t-card p-[16px] shadow-glass', fill && 'min-h-[586px] flex-1', className)}>
      {children}
    </div>
  );
}

/** Toolbar strip above a table (glass, radius 30, p-10, gap 10, glass shadow). Put a <ToolbarSpacer/> between left and right groups. */
export function ToolbarCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('glass flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar p-[10px] shadow-glass', className)}>
      {children}
    </div>
  );
}
export const ToolbarSpacer = () => <div className="h-px min-w-px flex-1" aria-hidden />;

export function THead({ children }: { children: ReactNode }) {
  return <div role="row" className="flex w-full shrink-0 items-start overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">{children}</div>;
}

type CellProps = { w?: number; grow?: boolean; children?: ReactNode; className?: string; align?: 'left' | 'right' };
const cellBox = (grow?: boolean) => cx('flex min-w-0 items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0');

export function TH({ w, grow, children, className, align }: CellProps) {
  return (
    <div role="columnheader" className={cx(cellBox(grow), align === 'right' && 'justify-end', className)} style={grow ? undefined : { width: w }}>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children ?? '​'}</span>
    </div>
  );
}

export type CellKind = 'id' | 'text' | 'strong' | 'small' | 'number' | 'custom';
const CELL_TEXT: Record<Exclude<CellKind, 'custom'>, string> = {
  id: 'font-mono text-[13px] font-medium leading-[18px] text-fg',
  text: 'text-[14px] leading-[20px] text-fg-2',
  strong: 'text-[14px] font-medium leading-[20px] text-fg',
  small: 'text-[12px] leading-[16px] text-fg-2',
  number: 'font-mono text-[14px] leading-[20px] text-fg',
};

export function TD({ w, grow, children, className, align, kind = 'custom' }: CellProps & { kind?: CellKind }) {
  return (
    <div role="cell" className={cx(cellBox(grow), align === 'right' && 'justify-end', className)} style={grow ? undefined : { width: w }}>
      {kind === 'custom' ? children : <span className={cx('truncate whitespace-nowrap', CELL_TEXT[kind])}>{children}</span>}
    </div>
  );
}

const rowCls = 'flex w-full shrink-0 items-center overflow-clip border-b border-line px-[16px] py-[14px] transition-colors hover:bg-surface';

/** A data row. Pass `to` for a navigable row (whole row is a link), or `onClick`. */
export function TR({ children, to, onClick, selected, className }: {
  children: ReactNode; to?: string; onClick?: () => void; selected?: boolean; className?: string;
}) {
  if (to) return <Link role="row" to={to} className={cx(rowCls, selected && 'bg-surface', className)}>{children}</Link>;
  return (
    <div
      role="row"
      onClick={onClick}
      className={cx(rowCls, onClick && 'cursor-pointer', selected && 'bg-surface', className)}
    >
      {children}
    </div>
  );
}

/** "Units verified" cell: 72×6 track (bg-disabled, radius 3) + fill (accent while partial, success when complete) + mono "n / N". */
export function UnitsProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="flex items-center gap-[10px] overflow-clip">
      <div className="flex h-[6px] w-[72px] shrink-0 items-start overflow-clip rounded-[3px] bg-disabled" aria-hidden>
        <div className={cx('h-[6px] rounded-[3px]', complete ? 'bg-success' : 'bg-accent')} style={{ width: Math.max(2, Math.round(72 * pct)) }} />
      </div>
      <span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">{done} / {total}</span>
    </div>
  );
}

/** Loading rows (177:102979): px-16 py-18, gap 24, 12px-high bars radius 6 in bg-disabled, 1px bottom border. */
export function SkeletonRows({ rows = 8, widths = [90, 110, 260, 70, 120, 70, 90] }: { rows?: number; widths?: number[] }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex w-full shrink-0 items-center gap-[24px] overflow-clip border-b border-line px-[16px] py-[18px]">
          {widths.map((w, j) => <div key={j} className="h-[12px] shrink-0 animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}
        </div>
      ))}
    </div>
  );
}
