// Shared Stores / Quality pieces (ST-D panel 177:139285).
// - StoresTableCard: list "Table card" = glass-strong, p-16, NO shadow; radius 28 on STR0 (177:139396), 24 on GL0
//   (177:139963). The kit TableCard is radius 28 + glass shadow (Purchase), so this one is local.
// - StoresCard: GRN detail split cards "GRN" / "Inspect" (177:139499 / 177:139532) = glass-strong, radius 24, p-24, gap 14.
// - CardTitle: Desktop/H2 18/24 SemiBold.
// - InnerHead / LineRow: the GRN card's table: header row bg-subtle, radius 18, px-14 py-10, gap 12; the selected line is
//   brand-subtle + 1px brand-border, radius 16, px-14 py-12; other lines have a 1px bottom border (STG5 177:139733).
// - ItemCell: item code (Data/ID 13/18 secondary) over name (14/20 Medium), gap 2.
// - LockedQty: posted value = 12px lock + Data/Number 14/20 secondary, gap 4 (STG4 177:139699).
// - KV: "Posted" panel rows, 14/20: label secondary flex-1, value Medium primary (177:139719).
// - PoBadge / GrnBadge: kit <Badge>; label = API enum with underscores as spaces, except PARTIAL which Figma draws as
//   "n OF m POSTED" (GL0 177:139990).
import type { ReactNode } from 'react';
import { IconLock } from '@tabler/icons-react';
import { enumLabel, formatQty } from '../../lib/format';
import { toneOf } from '../../lib/tones';
import { Badge, GlassCard, Ic, cx } from '../../ui/desktop';
import type { GrnStatus, PoStatus } from './api';

export function StoresTableCard({ children, radius = 28, className }: { children: ReactNode; radius?: 24 | 28; className?: string }) {
  return (
    <GlassCard
      strong
      radius={radius === 24 ? 'rounded-[24px]' : 'rounded-t-card'}
      className={cx('flex min-h-[808px] w-full flex-1 flex-col items-stretch p-[16px]', className)}
    >
      {children}
    </GlassCard>
  );
}

export function StoresCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard strong radius="rounded-[24px]" className={cx('flex flex-col items-start gap-[14px] p-[24px]', className)}>
      {children}
    </GlassCard>
  );
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{children}</h2>
      {right}
    </div>
  );
}

/** `indent` = the list-card copy (STR0 177:139457), drawn with two leading spaces (whitespace-pre). */
export function PricesNote({ indent, className }: { indent?: boolean; className?: string }) {
  return (
    <p className={cx('text-[12px] leading-[16px] text-fg-muted', indent ? 'whitespace-pre' : 'whitespace-nowrap', className)}>
      {indent ? '  ' : ''}Quantities only — prices are not shown to Stores.
    </p>
  );
}

export function ItemCell({ code, name }: { code: string; name: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
      <p className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{code}</p>
      <p className="truncate text-[14px] font-medium leading-[20px] text-fg">{name}</p>
    </div>
  );
}

export function LockedQty({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-[4px] overflow-clip">
      <Ic icon={IconLock} size={12} className="text-fg-2" />
      <span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg-2">{formatQty(value)}</span>
    </span>
  );
}

export function KV({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-[8px] overflow-clip text-[14px] leading-[20px]">
      <p className="min-w-px flex-1 text-fg-2">{label}</p>
      <p className="shrink-0 whitespace-nowrap font-medium text-fg">{value}</p>
    </div>
  );
}

export function PoBadge({ status }: { status: PoStatus }) {
  return <Badge tone={toneOf('purchaseOrder', status)} label={enumLabel(status)} />;
}

export function GrnBadge({ status, posted, total }: { status: GrnStatus; posted: number; total: number }) {
  return <Badge tone={toneOf('grn', status)} label={status === 'PARTIAL' ? `${posted} OF ${total} POSTED` : enumLabel(status)} />;
}
