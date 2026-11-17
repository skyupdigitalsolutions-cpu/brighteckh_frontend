// Shared BR-10 MIS pieces. NO Figma frames exist for MIS (agreed 17 Nov 2026: build with the shared desktop kit and
// existing frame conventions; pixel pass later). Conventions borrowed:
// - MisCard: the Stores / Sales detail card (glass-strong, radius 24, p-24, gap 14) with an 18/24 SemiBold title.
// - Badges: kit <Badge>, label = API enum with underscores as spaces.
// - Readiness: API `readiness[].status` is free text ("why a metric is null/partial"); tone by meaning below.
// - PiiChip: on-screen masking state comes ONLY from scope.pii_unmasked (masking is server-side).
import type { ReactNode } from 'react';
import { IconEye, IconEyeOff, IconLock } from '@tabler/icons-react';
import { enumLabel } from '../../lib/format';
import { toneOf, type Tone } from '../../lib/tones';
import { Badge, GlassCard, Ic, cx } from '../../ui/desktop';

export function MisCard({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <GlassCard strong radius="rounded-[24px]" className={cx('flex flex-col items-start gap-[14px] p-[24px]', className)}>
      {(title || right) && (
        <div className="flex w-full items-center gap-[10px]">
          <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </GlassCard>
  );
}

export const StatusBadge = ({ status }: { status: 'INACTIVE' | 'ACTIVE' | 'REVOKED' }) =>
  <Badge tone={toneOf('br10Status', status)} label={status} />;

export const KpiBadge = ({ status }: { status: 'DRAFT' | 'VALIDATED' }) =>
  <Badge tone={toneOf('kpiStatus', status)} label={`KPI ${status}`} />;

const READINESS_TONE: Record<string, Tone> = {
  ACTIVE: 'success', LEDGER: 'success',
  PENDING_CONFIG: 'blocked', SUPPLIER_MASTER_PENDING: 'blocked', NOT_MODELLED: 'blocked', UNVERIFIED: 'blocked', WITHHELD: 'blocked',
  DRAFT: 'progress', COUNTS_ONLY: 'neutral', INFO: 'neutral', NOT_INFERRED: 'neutral',
};
export const ReadinessBadge = ({ status }: { status: string }) =>
  <Badge tone={READINESS_TONE[status] ?? 'neutral'} label={enumLabel(status)} />;

/** Customer name / GSTIN state for the report on screen. */
export function PiiChip({ unmasked }: { unmasked: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-[6px] rounded-t-sm border px-[8px] py-[3px] text-[11px] font-semibold leading-[14px] tracking-[0.44px]',
        unmasked ? 'border-st-progress-bd bg-st-progress-bg text-st-progress-fg' : 'border-st-neutral-bd bg-st-neutral-bg text-st-neutral-fg',
      )}
      title={unmasked
        ? 'You hold an ACTIVE PII_CUSTOMER VIEW grant for every company in scope: customer name and GSTIN are shown in full.'
        : 'Customer name and GSTIN are masked by the server. Unmasking needs an ACTIVE PII_CUSTOMER VIEW grant.'}
    >
      <Ic icon={unmasked ? IconEye : IconEyeOff} size={12} />
      {unmasked ? 'CUSTOMER PII SHOWN' : 'CUSTOMER PII MASKED'}
    </span>
  );
}

/** One access cell: ACTIVE grant / awaiting approval / none. */
export function AccessState({ status }: { status: 'ACTIVE' | 'INACTIVE' | null }) {
  if (status === 'ACTIVE') return <Badge tone="success" label="GRANTED" />;
  if (status === 'INACTIVE') return <Badge tone="progress" label="AWAITING APPROVAL" />;
  return (
    <span className="inline-flex items-center gap-[4px] whitespace-nowrap text-[12px] leading-[16px] text-fg-muted">
      <Ic icon={IconLock} size={12} /> No grant
    </span>
  );
}

/** Label / value rows inside MisCard (14/20: label secondary flex-1, value Medium). */
export function KV({ label, value, mono }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex w-full items-start gap-[8px] overflow-clip text-[14px] leading-[20px]">
      <p className="min-w-px flex-1 text-fg-2">{label}</p>
      <div className={cx('shrink-0 text-right font-medium text-fg', mono && 'font-mono text-[13px] leading-[18px]')}>{value}</div>
    </div>
  );
}
