// Shared Sales desk pieces (S-D panel 177:137224).
// - StageBadge / ResponseBadge: kit <Badge>, label = the exact API enum value with underscores as spaces (badge rule).
// - SalesTableCard: Figma "Table card" in the Sales frames (SS0 177:138517, SR0 177:139232) = glass-strong, radius 24,
//   p-16, no shadow — the kit TableCard is radius 28 + glass shadow (Purchase), so the Sales card is local.
// - SalesTabBar / SalesToolbar: SS0 tab bar 177:138505 (glass-strong, radius 28, px-24 py-6, gap 32) and toolbar
//   177:138511 (glass-strong, radius 30, pl-20 pr-10 py-10, gap 10) — kit TabBar / ToolbarCard are glass + shadow.
// - SeeAll / CardHead: dashboard card head (SD0 177:137231): 20/28 SemiBold + "See all" pill (subtle, 1px border,
//   radius 18, px-16 py-8, 14/20 Medium).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { enumLabel } from '../../lib/format';
import { Badge, GlassCard, cx } from '../../ui/desktop';
import { RESPONSE_TONE, STAGE_TONE, type ResponseType, type SalesStage } from './api';

export function StageBadge({ stage, className }: { stage: SalesStage; className?: string }) {
  return <Badge tone={STAGE_TONE[stage]} label={enumLabel(stage)} className={className} />;
}

export function ResponseBadge({ type, className }: { type: ResponseType; className?: string }) {
  return <Badge tone={RESPONSE_TONE[type] ?? 'neutral'} label={enumLabel(type)} className={className} />;
}

export function SalesTableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard strong radius="rounded-[24px]" className={cx('flex min-h-[586px] w-full flex-1 flex-col items-stretch p-[16px]', className)}>
      {children}
    </GlassCard>
  );
}

export function SalesTabBar({ children, label }: { children: ReactNode; label: string }) {
  return (
    <nav aria-label={label} className="glass-strong flex w-full items-start gap-[32px] overflow-x-auto overflow-y-clip rounded-t-card px-[24px] py-[6px]">
      {children}
    </nav>
  );
}

export function SalesToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="glass-strong flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar py-[10px] pl-[20px] pr-[10px]">
      {children}
    </div>
  );
}

export function SeeAll({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0 items-start overflow-clip whitespace-nowrap rounded-t-chip border border-line bg-subtle px-[16px] py-[8px] text-[14px] font-medium leading-[20px] text-fg hover:bg-surface"
    >
      See all
    </Link>
  );
}

export function CardHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex w-full shrink-0 items-center gap-[12px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[20px] font-semibold leading-[28px] text-fg">{title}</h2>
      {right}
    </div>
  );
}

/** Loading placeholder bar. */
export function Skel({ w, h = 14, dark }: { w: number | string; h?: number; dark?: boolean }) {
  return <span className={cx('block shrink-0 animate-pulse rounded-[6px]', dark ? 'bg-[rgba(24,24,27,0.12)]' : 'bg-disabled')} style={{ width: w, height: h }} aria-hidden />;
}
